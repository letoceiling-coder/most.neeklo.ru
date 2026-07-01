/**
 * Official Git repository for PC agent setup.
 * Override at build time: VITE_MOST_GIT_REPO=https://github.com/org/repo.git
 */
export const MOST_GIT_REPO =
  (import.meta.env.VITE_MOST_GIT_REPO as string | undefined)?.trim() ||
  'https://github.com/letoceiling-coder/most.neeklo.ru.git';

export function gitCloneCommand(projectRoot: string): string {
  return `git clone ${MOST_GIT_REPO} "${projectRoot}"`;
}
