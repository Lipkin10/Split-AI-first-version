# Balance Query Translations Template

This file contains the translation keys that need to be added to each language file in the `messages/` directory to support conversational balance queries.

## English Template (en-US.json)

Add this section to each language file under the `"Conversation"` key:

```json
{
  "Conversation": {
    "Balance": {
      "specificOwesYou": "{name} owes you {amount}",
      "youOweSpecific": "You owe {name} {amount}",
      "evenWithSpecific": "You and {name} are even",
      "owesYou": "{name} owes you {amount}",
      "youOwe": "You owe {name} {amount}",
      "evenWith": "You and {name} are even",
      "needSpecificPerson": "Which person would you like to check the balance with?",
      "participantNotFound": "I couldn't find '{name}' in this group.",
      "availableParticipants": "Available participants",
      "balanceWith": "Balance with {name}",
      "paid": "Total paid",
      "paidFor": "Share of expenses",
      "showAllBalances": "Show me all balances",
      "viewAllBalances": "View all balances",
      "howToSettle": "How should we settle up?",
      "allBalances": "All balances",
      "quickInsights": "Quick insights",
      "totalParticipants": "{count, plural, =1 {1 participant} other {# participants}}",
      "activeBalances": "{count, plural, =0 {No active balances} =1 {1 active balance} other {# active balances}}",
      "suggestedReimbursements": "{count, plural, =0 {No reimbursements needed} =1 {1 reimbursement} other {# reimbursements}}",
      "showReimbursements": "Show reimbursements",
      "suggestedSettlements": "Suggested settlements",
      "allSettled": "All balances are settled! 🎉",
      "optimizationTip": "💡 Optimization tip",
      "optimizationExplanation": "These suggestions minimize the number of transactions needed to settle all balances.",
      "traditionalView": "Traditional view",
      "needSpecificPersonReimbursement": "Which person are you asking about?",
      "reimbursementStatus": "Reimbursement status with {name}",
      "allSettledWith": "All settled with {name}! ✅",
      "stillOwesYou": "{name} still owes you {amount}",
      "youStillOwe": "You still owe {name} {amount}",
      "seeDetails": "See details",
      "historicalNote": "📊 Historical Balance Query",
      "historicalExplanation": "Historical balance queries are coming soon! For now, here are your current balances.",
      "currentBalances": "Current balances",
      "viewCurrentBalances": "View current balances",
      "unknownQueryType": "I'm not sure what balance information you're looking for. Here are your current balances:"
    }
  }
}
```

## Languages to Translate

The following language files need the above translations added:

- [ ] `de-DE.json` (German)
- [ ] `es.json` (Spanish)
- [ ] `fi.json` (Finnish)
- [ ] `fr-FR.json` (French)
- [ ] `it-IT.json` (Italian)
- [ ] `nl-NL.json` (Dutch)
- [ ] `pl-PL.json` (Polish)
- [ ] `pt-BR.json` (Portuguese Brazil)
- [ ] `ro.json` (Romanian)
- [ ] `ru-RU.json` (Russian)
- [ ] `tr-TR.json` (Turkish)
- [ ] `ua-UA.json` (Ukrainian)
- [ ] `zh-CN.json` (Chinese Simplified)
- [ ] `zh-TW.json` (Chinese Traditional)

## Translation Guidelines

1. **Maintain Placeholders**: Keep placeholders like `{name}`, `{amount}`, `{count}` exactly as they are
2. **Plural Forms**: Use appropriate plural forms for each language
3. **Cultural Context**: Adapt phrases to be natural in each language
4. **Currency**: Consider local currency formatting preferences
5. **Emojis**: Emojis are generally universal, but consider cultural appropriateness

## Implementation

Once translations are added, the balance query feature will automatically work in all supported languages based on the user's locale setting.