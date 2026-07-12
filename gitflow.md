# Git Flow

2 weeks -> project demo -> easy flow နဲ့ သွားကြမယ်

# Branch

main
develop (optional)
feature
fix
build
chore

eg: Branch Naming (keep it simple)
`feature/login` , `feature/profile`, `fix/navbar` , `build/ci` , etc.

# Protect main

PR required
No direct push
At least one approval

# Daily workflow

```
# new branch
git checkout main
git pull origin main
git checkout -b feature/login

# existing
git fetch origin
git rebase origin/main
```

feature တခုလုံး ဒါမှမဟုတ် big function တခုခု ပြီးတိုင်း commit ပါ

```
git push origin feature/login
```

ပြီးရင် open PR to `main` , Review and approval at least 1 dev

merge -> delete source branch

# Commit messages

```
[type] <short_description>
```

type: `feat`, `fix`, `docs`, `build`, `style` , `refactor` , `test` , `chore`, `ci`

## Examples

- `feat: added user login functionality`
- `fix: corrected typo in response message`
- `docs: added setup steps to README.md`
- `build: updated config for production`
- `chore: updated dependencies`
- `ci: added cicd for deployment`
- `style: fixed formatting`
- `refactor: simplified authentication flow`
- `test: added unit test for payment module`

### Merge commit ‌‌also has to follow commit format

feature ownership နဲ သွားကြမယ်
code review -> 1 reviewer ok -> ကိုယ့် PR မှာ အလှည့်ကျ assign

Roles တွေ ခွဲချင်ရင် -
owner/lead
Supabase / Data
QA / documentation

(optionals)
UI/UX

....
