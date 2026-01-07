# Git Quick Reference - Music Bingo Project

## Custom Aliases (Shortcuts)

These shortcuts are configured for this project. Use them instead of typing full commands!

### Basic Shortcuts

| Alias | Full Command | Description |
|-------|-------------|-------------|
| `git st` | `git status` | Check what files have changed |
| `git co <branch>` | `git checkout <branch>` | Switch to a branch |
| `git br` | `git branch` | List all branches |
| `git cm "message"` | `git commit -m "message"` | Quick commit with message |
| `git aa` | `git add --all` | Stage all changes |
| `git ap` | `git add -p` | Stage changes interactively (review each change) |

### Useful Shortcuts

| Alias | Full Command | Description |
|-------|-------------|-------------|
| `git lg` | `git log --oneline --graph --all --decorate` | Visual branch history |
| `git last` | `git log -1 HEAD` | Show last commit details |
| `git unstage <file>` | `git reset HEAD <file>` | Unstage a file |
| `git undo` | `git reset --soft HEAD~1` | Undo last commit (keep changes) |

### Workflow Shortcuts

| Alias | Full Command | Description |
|-------|-------------|-------------|
| `git save` | `git add -A && git commit -m 'WIP: Save point'` | Quick save everything (work in progress) |
| `git sync` | `git pull && git push` | Pull latest then push your changes |

## Common Workflows

### Daily Development Flow
```bash
# Check what changed
git st

# Stage specific files
git add src/components/NewComponent.tsx

# Or stage everything
git aa

# Commit with message
git cm "Add new audio visualizer component"

# Push to GitHub
git push
```

### Feature Branch Workflow
```bash
# Create and switch to new branch
git co -b feature/new-feature

# Work on your feature...
git aa
git cm "Implement feature"

# Switch back to main
git co main

# Merge feature branch
git merge feature/new-feature

# Delete feature branch
git br -d feature/new-feature

# Push to GitHub
git push
```

### Quick Save and Continue
```bash
# Save current work without thinking about commit message
git save

# Continue working...
# Later, you can clean this up with:
git undo    # Undo the WIP commit
git aa      # Stage changes again
git cm "Proper commit message"
```

### Sync with Remote
```bash
# Get latest and push your work
git sync

# Or do it manually:
git pull
git push
```

### Check History
```bash
# Beautiful visual history
git lg

# Last commit only
git last

# Full history
git log

# Changes in a file over time
git log -p src/components/MediaControl.tsx
```

### Undo Mistakes

```bash
# Unstage a file (but keep changes)
git unstage src/utils/helper.ts

# Undo last commit (keep changes staged)
git undo

# Discard all local changes (CAREFUL!)
git checkout -- .

# Discard changes in one file (CAREFUL!)
git checkout -- src/App.tsx
```

## Project-Specific Quick Commands

### Before Committing
```bash
git st                           # What changed?
git diff                         # See the changes
npm run dev                      # Test it runs
git aa                           # Stage everything
git cm "Your message here"       # Commit
git push                         # Push to GitHub
```

### Check Before Push
```bash
git lg                           # Review commits
git last                         # Check last commit
git st                           # Ensure working tree is clean
git push                         # Push
```

### Working on New Feature
```bash
git co -b feature/shuffle-mode   # New branch
# ... do work ...
git save                         # Quick save points
# ... more work ...
git save                         # Another save point
# ... finish feature ...
git co main                      # Switch to main
git merge feature/shuffle-mode   # Merge it in
git push                         # Push to GitHub
```

### Emergency: Need to Switch Context
```bash
# Save your work without committing
git stash

# Switch to main and do urgent fix
git co main
git aa
git cm "Fix critical bug"
git push

# Go back to your work
git co feature/your-feature
git stash pop                    # Restore your work
```

## Tips for This Project

1. **Test before you commit**
   ```bash
   npm run dev    # Make sure it starts
   git aa
   git cm "Your message"
   ```

2. **Review before staging**
   ```bash
   git diff       # See what changed
   git ap         # Stage interactively
   ```

3. **Clean commit history**
   ```bash
   git lg         # Check your commits
   # If you have multiple "WIP" commits, consider squashing them
   ```

4. **Keep main clean**
   - Use feature branches for experiments
   - Only merge when feature is complete
   - Test before merging

## Keyboard Shortcuts (if using VS Code)

- `Ctrl + Shift + G` - Open Source Control panel
- `Ctrl + Enter` - Commit staged changes
- Click "+"/"-" icons to stage/unstage files

## Need Help?

```bash
git help <command>              # Built-in help
git <alias> --help              # Help for a command
git config --list               # See all your settings
git config --get-regexp alias   # See all your aliases
```

## Advanced Aliases (Optional)

Want to add more? Use these commands:

```bash
# Example: Add a "cleanup" alias
git config --local alias.cleanup "!git branch --merged | grep -v '\\*\\|main\\|master' | xargs -n 1 git branch -d"

# Example: Add "amend" to fix last commit
git config --local alias.amend "commit --amend --no-edit"

# Example: Show what would be pushed
git config --local alias.preview "log @{u}.. --oneline"
```

## Remember

- **Commit often** - It's easier to combine commits than split them
- **Use descriptive messages** - Your future self will thank you
- **Pull before push** - Avoid conflicts
- **Branch for features** - Keep main stable
- **Review before commit** - Use `git st` and `git diff`

---

**Pro Tip:** Type `git lg` regularly to see your commit history as a visual graph. It helps you understand where you are in your development!
