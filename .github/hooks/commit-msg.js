const truskCommitMsgRegex = /^(Fix|Test|Feature)\([A-Z][a-z]*(\/[A-Z][a-z]*)*\):[A-Za-z0-9\s]+$/;
const commitMsg = require('fs').readFileSync(process.env.HUSKY_GIT_PARAMS, 'utf8')

if (!truskCommitMsgRegex.test(commitMsg) ) {
  console.error(`Invalid commit message! See Trusk best practices here: https://github.com/trusk-official/trusk-best-practices/blob/master/git_process.md`);
  process.exit(1);
}
