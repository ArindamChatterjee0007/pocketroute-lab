export const repository = "ArindamChatterjee007/pocketroute-lab";

export function assertGitHubRunner(environment = process.env) {
  if (
    environment.GITHUB_ACTIONS !== "true" ||
    environment.RUNNER_OS !== "Linux" ||
    environment.RUNNER_ENVIRONMENT !== "github-hosted" ||
    environment.GITHUB_REPOSITORY !== repository ||
    !environment.GITHUB_WORKSPACE
  ) {
    throw new Error("This project builds, tests and runs models only on its GitHub-hosted Linux workflow. Local execution is disabled.");
  }
}

assertGitHubRunner();