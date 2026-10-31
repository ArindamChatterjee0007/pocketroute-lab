cmake_minimum_required(VERSION 3.22.1)
project(pocketroute_native LANGUAGES CXX)

add_library(onnxruntime SHARED IMPORTED)
set_target_properties(onnxruntime PROPERTIES
    IMPORTED_LOCATION "${ORT_DIRECTORY}/jni/${ANDROID_ABI}/libonnxruntime.so")

add_library(pocketroute_native SHARED native_engine.cpp)
target_compile_features(pocketroute_native PRIVATE cxx_std_17)
target_compile_options(pocketroute_native PRIVATE -Wall -Wextra -Werror)
target_include_directories(pocketroute_native SYSTEM PRIVATE "${ORT_DIRECTORY}/headers")
target_link_libraries(pocketroute_native PRIVATE onnxruntime)
