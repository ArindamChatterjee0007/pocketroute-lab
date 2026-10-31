#include <jni.h>
#include <onnxruntime_cxx_api.h>
#include <sys/resource.h>

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <memory>
#include <stdexcept>
#include <string>
#include <vector>

namespace {
struct Engine {
    Ort::Env environment{ORT_LOGGING_LEVEL_ERROR, "pocketroute"};
    Ort::SessionOptions options;
    Ort::Session session{nullptr};
    int layers;
    int heads;
    int dimension;
    int vocabulary;
    std::vector<std::string> inputs;

    Engine(const char* path, int layer_count, int head_count, int head_dimension, int vocab)
        : layers(layer_count), heads(head_count), dimension(head_dimension), vocabulary(vocab) {
        options.SetIntraOpNumThreads(2);
        options.SetInterOpNumThreads(1);
        options.SetGraphOptimizationLevel(GraphOptimizationLevel::ORT_ENABLE_ALL);
        session = Ort::Session(environment, path, options);
        Ort::AllocatorWithDefaultOptions allocator;
        std::vector<std::string> expected{"input_ids", "attention_mask", "position_ids"};
        for (int layer = 0; layer < layers; ++layer) {
            expected.push_back("past_key_values." + std::to_string(layer) + ".key");
            expected.push_back("past_key_values." + std::to_string(layer) + ".value");
        }
        for (size_t index = 0; index < session.GetInputCount(); ++index) {
            std::string name = session.GetInputNameAllocated(index, allocator).get();
            if (std::find(expected.begin(), expected.end(), name) == expected.end()) {
                throw std::runtime_error("Unsupported graph input: " + name);
            }
            auto type = session.GetInputTypeInfo(index);
            auto info = type.GetTensorTypeAndShapeInfo();
            auto shape = info.GetShape();
            bool cache = name.rfind("past_key_values.", 0) == 0;
            if (cache) {
                if (info.GetElementType() != ONNX_TENSOR_ELEMENT_DATA_TYPE_FLOAT || shape.size() != 4
                    || (shape[1] >= 0 && shape[1] != heads) || (shape[3] >= 0 && shape[3] != dimension)) {
                    throw std::runtime_error("Unsupported cache tensor: " + name);
                }
            } else if (info.GetElementType() != ONNX_TENSOR_ELEMENT_DATA_TYPE_INT64 || shape.size() != 2) {
                throw std::runtime_error("Unsupported request tensor: " + name);
            }
            inputs.push_back(name);
        }
        auto actual = inputs;
        std::sort(actual.begin(), actual.end());
        std::sort(expected.begin(), expected.end());
        if (actual != expected) throw std::runtime_error("Missing frozen graph inputs.");
        bool logits = false;
        for (size_t index = 0; index < session.GetOutputCount(); ++index) {
            std::string name = session.GetOutputNameAllocated(index, allocator).get();
            if (name == "logits") {
                auto type = session.GetOutputTypeInfo(index);
                auto info = type.GetTensorTypeAndShapeInfo();
                auto shape = info.GetShape();
                if (info.GetElementType() != ONNX_TENSOR_ELEMENT_DATA_TYPE_FLOAT || shape.size() != 3
                    || (shape.back() >= 0 && shape.back() != vocabulary)) {
                    throw std::runtime_error("Unsupported logits tensor.");
                }
                logits = true;
            }
        }
        if (!logits) throw std::runtime_error("The graph has no logits output.");
    }

    std::array<float, 4> classify(const std::vector<int64_t>& tokens, const std::array<int, 4>& choices) {
        if (tokens.empty() || tokens.size() > 2048) throw std::runtime_error("Invalid prompt token count.");
        for (int choice : choices) if (choice < 0 || choice >= vocabulary) throw std::runtime_error("Invalid choice token.");
        std::vector<int64_t> ids(tokens);
        std::vector<int64_t> mask(tokens.size(), 1);
        std::vector<int64_t> positions(tokens.size());
        for (size_t index = 0; index < positions.size(); ++index) positions[index] = static_cast<int64_t>(index);
        const std::array<int64_t, 2> shape{1, static_cast<int64_t>(tokens.size())};
        const std::array<int64_t, 4> empty_shape{1, heads, 0, dimension};
        auto memory = Ort::MemoryInfo::CreateCpu(OrtArenaAllocator, OrtMemTypeDefault);
        float empty = 0;
        std::vector<Ort::Value> values;
        std::vector<const char*> names;
        values.reserve(inputs.size());
        names.reserve(inputs.size());
        for (const std::string& name : inputs) {
            names.push_back(name.c_str());
            if (name == "input_ids") values.push_back(Ort::Value::CreateTensor<int64_t>(memory, ids.data(), ids.size(), shape.data(), shape.size()));
            else if (name == "attention_mask") values.push_back(Ort::Value::CreateTensor<int64_t>(memory, mask.data(), mask.size(), shape.data(), shape.size()));
            else if (name == "position_ids") values.push_back(Ort::Value::CreateTensor<int64_t>(memory, positions.data(), positions.size(), shape.data(), shape.size()));
            else values.push_back(Ort::Value::CreateTensor<float>(memory, &empty, 0, empty_shape.data(), empty_shape.size()));
        }
        const char* output_names[]{"logits"};
        Ort::RunOptions run_options;
        auto outputs = session.Run(run_options, names.data(), values.data(), values.size(), output_names, 1);
        auto info = outputs.at(0).GetTensorTypeAndShapeInfo();
        auto output_shape = info.GetShape();
        if (output_shape.size() != 3 || output_shape[0] != 1 || output_shape.back() != vocabulary || info.GetElementCount() < static_cast<size_t>(vocabulary)) {
            throw std::runtime_error("Invalid logits output shape.");
        }
        const float* logits = outputs.at(0).GetTensorData<float>();
        size_t last = info.GetElementCount() - static_cast<size_t>(vocabulary);
        std::array<float, 4> scores{};
        for (size_t index = 0; index < scores.size(); ++index) {
            scores[index] = logits[last + choices[index]];
            if (!std::isfinite(scores[index])) throw std::runtime_error("Non-finite choice score.");
        }
        return scores;
    }
};

void fail(JNIEnv* env, const std::exception& error) {
    jclass type = env->FindClass("java/io/IOException");
    if (type != nullptr) env->ThrowNew(type, error.what());
}
}

extern "C" JNIEXPORT jlong JNICALL
Java_dev_pocketroute_runtime_NativeEngine_nativeOpen(JNIEnv* env, jclass, jstring path, jint layers, jint heads, jint dimension, jint vocabulary) {
    const char* text = env->GetStringUTFChars(path, nullptr);
    if (text == nullptr) return 0;
    std::string location(text);
    env->ReleaseStringUTFChars(path, text);
    try {
        if (layers != 28 || heads != 2 || dimension != 128 || vocabulary != 151936) throw std::runtime_error("Unexpected frozen model geometry.");
        return reinterpret_cast<jlong>(new Engine(location.c_str(), layers, heads, dimension, vocabulary));
    } catch (const std::exception& error) {
        fail(env, error);
        return 0;
    }
}

extern "C" JNIEXPORT jfloatArray JNICALL
Java_dev_pocketroute_runtime_NativeEngine_nativeClassify(JNIEnv* env, jclass, jlong handle, jlongArray input, jintArray choice_ids) {
    try {
        if (handle == 0 || env->GetArrayLength(choice_ids) != 4) throw std::runtime_error("Invalid native request.");
        jsize count = env->GetArrayLength(input);
        if (count < 1 || count > 2048) throw std::runtime_error("Invalid prompt token count.");
        std::vector<jlong> source(static_cast<size_t>(count));
        env->GetLongArrayRegion(input, 0, count, source.data());
        std::array<jint, 4> ids{};
        env->GetIntArrayRegion(choice_ids, 0, 4, ids.data());
        if (env->ExceptionCheck()) return nullptr;
        std::vector<int64_t> tokens(source.begin(), source.end());
        std::array<int, 4> choices{ids[0], ids[1], ids[2], ids[3]};
        auto scores = reinterpret_cast<Engine*>(handle)->classify(tokens, choices);
        jfloatArray result = env->NewFloatArray(4);
        if (result != nullptr) env->SetFloatArrayRegion(result, 0, 4, scores.data());
        return result;
    } catch (const std::exception& error) {
        fail(env, error);
        return nullptr;
    }
}

extern "C" JNIEXPORT jobjectArray JNICALL
Java_dev_pocketroute_runtime_NativeEngine_nativeInputs(JNIEnv* env, jclass, jlong handle) {
    if (handle == 0) return nullptr;
    const auto& inputs = reinterpret_cast<Engine*>(handle)->inputs;
    jclass string_class = env->FindClass("java/lang/String");
    if (string_class == nullptr) return nullptr;
    jobjectArray result = env->NewObjectArray(static_cast<jsize>(inputs.size()), string_class, nullptr);
    if (result == nullptr) return nullptr;
    for (size_t index = 0; index < inputs.size(); ++index) {
        jstring name = env->NewStringUTF(inputs[index].c_str());
        if (name == nullptr) return nullptr;
        env->SetObjectArrayElement(result, static_cast<jsize>(index), name);
        env->DeleteLocalRef(name);
    }
    return result;
}

extern "C" JNIEXPORT jstring JNICALL
Java_dev_pocketroute_runtime_NativeEngine_nativeVersion(JNIEnv* env, jclass) {
    return env->NewStringUTF(OrtGetApiBase()->GetVersionString());
}

extern "C" JNIEXPORT jlong JNICALL
Java_dev_pocketroute_runtime_NativeEngine_nativePeakRss(JNIEnv*, jclass) {
    struct rusage usage{};
    if (getrusage(RUSAGE_SELF, &usage) != 0) return -1;
    return static_cast<jlong>(usage.ru_maxrss) * 1024;
}

extern "C" JNIEXPORT void JNICALL
Java_dev_pocketroute_runtime_NativeEngine_nativeClose(JNIEnv*, jclass, jlong handle) {
    delete reinterpret_cast<Engine*>(handle);
}
