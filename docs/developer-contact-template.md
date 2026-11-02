# Farm.Shrimp.io — "Contact the developers" page template

Nov 3, 2026

## Purpose

This is the planning sheet for a **Help** page that tells a farm how to reach the development team. The team fills it in, agrees on it, and then the page gets built from it.

Nothing here is final. Every fact on the page must come from the team, so each part below has prompts, not finished text. No names, numbers or addresses are filled in yet.

## Where it goes

1. **In the app:** a **Help** link at the bottom of the sidebar, above **Sign out**, opens one short page called "Contact the developers". Everyone who is signed in can open it, whatever their role.
2. **On the sign-in page:** a small "Need help?" link under the sign-in button leads to the same details. This matters because a Farm Owner who is locked out cannot get to the sidebar, and account recovery starts with a call (see [runbook](runbook.md), section 6).
3. **One source:** the contact line on the home page's Learn more section (part 6 of [learn-more-template.md](learn-more-template.md)) uses the same details, so they are written once and kept in one place.

The Help link stays out of the sidebar until this template is filled in. A link with nothing behind it would look broken.

## The template

The page has six parts, in this order. Parts 1, 2 and 4 are the minimum; the rest are optional.

| # | Part | Question it answers for a farm | Length |
| --- | --- | --- | --- |
| 1 | Who to contact | Who do I ask, and are they the people who built it? | 1–2 sentences |
| 2 | How to reach us | What number, address or app do I use, and when do they answer? | 3–4 lines |
| 3 | What to tell us | What should I write down so you can fix it faster? | 5–7 short items |
| 4 | Locked out or urgent | What do I do if I cannot sign in, or the system is down? | 3 short steps |
| 5 | What to expect | How soon will someone reply? | 1–2 sentences |
| 6 | Support details | What does the team need to see from my screen? | A small box with a copy button (optional) |

Fill in the brackets below. Delete a line rather than leave it empty.

```markdown
## Contact the developers

[1. WHO TO CONTACT — one or two sentences]
Farm.Shrimp.io was built by [team name or member names]. For help with the system, contact [who answers: e.g. the team's support person].

[2. HOW TO REACH US]
- Phone or text: [number] — [hours, e.g. Mon–Sat, 8 AM to 6 PM]
- Email: [address] — [who checks it, how often]
- Messaging app: [app and name or number, if used]
- In person: [where and when, if the team visits the farm]

[3. WHAT TO TELL US — keep it to what a farm can see]
- Your name and the farm's name
- The page you were on (for example "Feeding" or "Logbooks")
- What you were doing and what you expected
- What happened, and any message shown on the screen
- The date and time it happened
- A photo of the screen, if you can take one

[4. LOCKED OUT OR URGENT]
If you cannot sign in: call [number]. [Who verifies identity: e.g. a second Farm Owner or the agreed security question.] You will get a temporary password and set a new one when you sign in.
If the system is down: [what to do first, e.g. keep recording on paper sheets, then call].
Never send your password to anyone, including us.

[5. WHAT TO EXPECT]
We reply within [time] on [days]. Urgent calls are answered [when].

[6. SUPPORT DETAILS — optional]
Farm: [farm name and code]    Signed in as: [name, role]
App version: [version]        Date and time: [farm time]
[Button] Copy these details
```

## Facts we already have

These are already written in the project's documents. Confirm each one before it goes on the page; the contact details themselves need the team.

| Fact | For part | Where it is written | Confirm with |
| --- | --- | --- | --- |
| The System Administrator account is held by the development team and handles installation, farm activation and account recovery | 1, 4 | [Capstone-Planning.md](Capstone-Planning.md), "Users and roles" | Team |
| A locked-out Farm Owner contacts the administrator in person or by phone, and identity is checked through a second Farm Owner or the agreed security question | 4 | [runbook.md](runbook.md), section 6 | Team |
| The administrator issues a temporary password, shown once, and the Owner must set a new one at sign-in | 4 | [runbook.md](runbook.md), section 6 | Team |
| The administrator never reads or changes farm records to recover an account | 4 | [runbook.md](runbook.md), section 6 | Team |
| The system runs on the farm's own network, without Internet | 2 | [README](../README.md) | Team |
| On the farm network, a mail link only opens the device's mail app, so a contact form that sends email would not work | 2 | [learn-more-template.md](learn-more-template.md), decisions table | Team |
| The app version is shown on the health page | 6 | [runbook.md](runbook.md), section 7 | Team (the health page is for the administrator, so the version needs to be readable by every user for part 6) |

## Decisions for the team

Seven questions to settle in the discussion. The first option in each is the suggested default.

| Question | Options | Notes |
| --- | --- | --- |
| Where does the contact page appear? | In the app and on the sign-in page · in the app only · on the sign-in page only | A locked-out Owner cannot reach the in-app page, so the sign-in page needs it too. |
| Which contact methods do we offer? | Phone plus email · phone only · phone, email and a messaging app | Someone must answer each one. With no Internet on the farm network, a phone number always works. |
| Who answers, and when? | One named support person with set hours · the whole team in turns · the adviser's office | Say the hours on the page, or people will wait for an answer that is not coming. |
| What do we promise for response time? | A time for ordinary questions and a faster one for urgent calls · no promise · a promise for urgent calls only | Promise only what the team can keep. |
| Do we add a "Copy support details" button? | Yes, with farm, user, role, app version and time · no | It saves the farm from typing details. Needs a small build, but no new data stored. |
| Are team members' names and numbers shown? | Support person only · all members · a shared team number only | Names and personal numbers need each person's yes first. |
| What language? | English · English with Filipino or Cebuano | Match the farm staff who will read it. |

## Writing rules

The page should read in under a minute, on a tablet at the ponds.

- **Short and in order.** Who, how, what to tell us, what to do if locked out. Nothing else.
- **Plain words.** "Call us" and "tell us what you were doing", not "submit a support ticket".
- **Only what is true today.** No chat line that nobody watches, no hours the team cannot keep.
- **Contact details written once.** The same text feeds this page, the sign-in page and the Learn more section.
- **Names and numbers only with permission.** Each person who is named needs a yes first.
- **No passwords, ever.** Say it on the page.
- **Text, not images of text.** The farm network has no Internet, so anything shown is bundled with the app.

## Next steps

- [ ] Team discusses the seven decisions and notes the answers in the table
- [ ] Ask permission from everyone whose name or number goes on the page
- [ ] Fill in the template's brackets and delete unused lines
- [ ] Decide whether the app version should be readable by every user (part 6)
- [ ] Send the filled-in text to Claude to build: the Help page, the sidebar link, and the "Need help?" link on the sign-in page
- [ ] Check it on a laptop and a tablet before it goes to main
