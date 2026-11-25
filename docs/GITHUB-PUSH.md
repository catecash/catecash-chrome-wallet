# GitHub push requirements

This repository lives at `git@github.com:catecash/catecash-chrome-wallet.git`. In the OpenZcash workspace, the GitHub SSH host is configured in `~/.ssh/config` to use `~/.ssh/armenmerik`. The key is on the local machine, outside the repository. Do not commit or display the private key.

Before a push:

1. Confirm the repository, target branch, remote URL, and diff.
2. Confirm the SSH identity file exists and `ssh -G github.com` selects it. Use the configured SSH remote for GitHub.
3. Run checks appropriate to the changes, then commit and push.
4. Verify the remote branch contains the pushed commit.

After every GitHub push, report:

- **What was asked:** the user's request.
- **What changed:** the files or behavior changed, checks run, repository, branch, and commit or link.
- **What remains:** any unfinished work, limitations, or follow-up. Say `Nothing remains` when complete.

If the push or verification fails, say so plainly under **What remains** and include the error without exposing credentials.
