# Language Rule

## Objective

This rule ensures that all public content in the project is written in English for international accessibility and GitHub publication.

## Scope

All content in the project must be in English, except for specific exceptions:

### Must be in English

- **Documentation files**: README.md, CHANGELOG.md, KANBAN.md, etc.
- **Code comments**: All comments in TypeScript and other code files
- **Cline rules and workflows**: All files in `.clinerules/` directory
- **Test files**: All test descriptions, assertions, and comments
- **Configuration files**: .env.example, package.json descriptions, etc.
- **Git commit messages**: Must follow Conventional Commits in English (see commit_messages.md)

### Exceptions (must remain in French)

- None in this project (no localization files)

### Technical terms

Technical terms and proper nouns should remain in their original language:
- Variable names, function names, class names
- API names, library names, framework names
- Brand names, product names
- Technical acronyms and abbreviations

## When to verify

After each file creation or modification:
1. Check that all text content is in English
2. Verify comments are in English
3. Ensure documentation follows English grammar and spelling

## Verification checklist

Before marking a task as complete, verify:

- [ ] All user-facing text is in English
- [ ] All code comments are in English
- [ ] Documentation files are in English
- [ ] Configuration file descriptions are in English
- [ ] Test descriptions and assertions are in English

## Conversation Language Preference

Always respond in French to the user, unless the user explicitly requests another language.

- Use French for all responses, explanations, and clarifications
- Technical terms, code, and proper names should remain in their original language
- File paths, command examples, and configuration should use their original format
- If the user switches to English or another language, follow their preference

**Example:**
- Correct (French): "Je vais créer le fichier de configuration pour vous."
- Incorrect (English): "I will create the configuration file for you."
- Technical terms: "Utilisez le hook `useState` pour gérer l'état dans React."