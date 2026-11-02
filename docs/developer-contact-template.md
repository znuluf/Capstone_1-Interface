# Developer contact template (Help page)

The Help page (`/app/help`, sidebar **Help**) shows how farm users reach the team. Its text lives in one place:
`HELP_CONTACT` in `angular/src/app/fpms/account/help.component.ts`. Any value still in `[square brackets]` is shown
highlighted, with a note that the team has not filled it in yet. Replace each value once the team agrees on it.

| Key | What to write | Example |
| --- | --- | --- |
| `builtBy` | Team name or member names | Team Hipon: A. Cruz, B. Reyes |
| `whoAnswers` | Who answers questions about the system | the team lead |
| `phone` | Phone or text number | 0917 000 0000 |
| `phoneHours` | When the phone is answered | Mon–Sat, 8 AM–5 PM |
| `email` | Support email address | fpms.team@example.edu |
| `emailChecked` | Who checks it, how often | checked daily by the team lead |
| `messaging` | Messaging app and name or number, if used | Messenger: Team Hipon |
| `inPerson` | Where and when, if the team visits the farm | at the farm office, Saturdays |
| `identityCheck` | How identity is checked before a password reset | A second Farm Owner confirms who you are. |
| `systemDown` | What to do first when the system is down | keep recording on the paper sheets, then call |
| `replyWithin` | How fast the team replies | one working day |
| `replyDays` | Days the team replies | weekdays |
| `urgentWhen` | When urgent calls are answered | the same day |

Notes

- The **Support details** box (farm, signed-in user, app version, farm date and time) is filled in by the system;
  **Copy these details** puts them on the clipboard so a user can paste them into a message.
- Keep the warning "Never send your password to anyone, including us." as it is.
- The page is only shown to signed-in users.
