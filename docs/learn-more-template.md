# Farm.Shrimp.io — "Learn more" content template

Nov 2, 2026

## Purpose

This is the planning sheet for what the home page's **Learn more** button will show. The team fills it in, agrees on it, and then the page gets built from it.

Nothing here is final. Every fact in the page must come from the team, so each part below has prompts, not finished text.

## Where it goes

The button replaces the second **Sign in** button under the headline. Sign in stays in the top bar, so nothing is lost.

1. The first screen stays as it is now: wordmark, "Feed. Log. Harvest.", one line, then **Create a farm account** and **Learn more**.
2. Learn more scrolls down to one short About section below the first screen. Nobody sees it unless they ask.
3. The About section ends with **Create a farm account** again, so a reader who is convinced can start straight away.

The page stays as it is until this template is filled in. A button with nothing behind it would look broken.

## The template

The About section has six parts, in this order. Parts 1, 2 and 4 are the minimum; the rest are optional.

| # | Part | Question it answers for a visitor | Length |
| --- | --- | --- | --- |
| 1 | What it is | What is Farm.Shrimp.io, and who is it for? | 1–2 sentences |
| 2 | What it keeps track of | What will it do for my farm? | 4–6 items, one line each |
| 3 | How it works on the farm | Will it work at my ponds, with my staff? | 3 short points |
| 4 | Who made it | Who is behind this, and can I trust it? | 1–2 sentences |
| 5 | Thanks and partners | Who helped build or test it? | 1–3 names |
| 6 | Contact | Who do I ask if I have questions? | 1 line |

Fill in the brackets below. Delete a line rather than leave it empty.

```markdown
## About Farm.Shrimp.io

[1. WHAT IT IS — one or two sentences]
Farm.Shrimp.io is [what it is] for [who: e.g. P. vannamei grow-out farms in ___].
It replaces [what it replaces: e.g. paper logbooks and spreadsheets].

[2. WHAT IT KEEPS TRACK OF — one line each, 4 to 6 items]
- [Feeding: ___]
- [Water quality: ___]
- [Growth and survival: ___]
- [Harvest and sales: ___]
- [Permits and licenses: ___]
- [Reports: ___]

[3. HOW IT WORKS ON THE FARM — three short points]
- [Network: e.g. runs on the farm's own network, no Internet needed]
- [Who uses it: e.g. Farm Owner, Farm Technician; what each one does]
- [Devices: e.g. shared tablet at the ponds, office computer]

[4. WHO MADE IT]
A capstone project by [team name or member names], [program],
[college], [university], [school year]. Adviser: [name, if named].

[5. THANKS AND PARTNERS — only with their permission]
Built with [partner farm / office], [how they helped].

[6. CONTACT]
Questions? [Contact method] — [who answers].

[Button] Create a farm account
```

## Facts we already have

The project's own documents already answer most of parts 1 to 3. Confirm each one before it goes on the page; parts 4 to 6 need the team.

| Fact | For part | Where it is written | Confirm with |
| --- | --- | --- | --- |
| For whiteleg shrimp (*Penaeus vannamei*) production | 1 | [README](../README.md) | Team |
| Built for a partner farm in Sarangani Province and General Santos City | 1, 5 | [README](../README.md) | Partner farm (may we name the area or the farm?) |
| Replaces paper logbooks and spreadsheets with one traceable record | 1 | [README](../README.md) | Team |
| Works out density, DOC, ABW, FCR and survival; tracks permit expiry | 2 | [README](../README.md) | Team |
| Water readings checked against GAqP ranges from PNS/BAFS 197:2025 | 2 | [decisions.md](../decisions.md), DEC-56 | Adviser (values still to confirm) |
| Runs on the farm's local network, without Internet | 3 | [README](../README.md) | Team |
| Farm Owners set up and review; Farm Technicians record the work at the ponds | 3 | [README](../README.md) | Team |
| Registering a farm takes three steps and signs the owner in | 3 | The register page in the app | Team |
| Built as a capstone project, with an adviser | 4 | [README](../README.md) | Team (names, program, year) |
| Separate from the partner organization's Shrimp.io decentralized application; not connected in version one | 1 | [docs/fpms.md](fpms.md) | Team |

The last row matters for wording: the page should not suggest Farm.Shrimp.io itself uses blockchain.

## Decisions for the team

Seven questions to settle in the discussion. The first option in each is the suggested default.

| Question | Options | Notes |
| --- | --- | --- |
| Where does Learn more lead? | An About section below the first screen · a separate About page · a PDF (project brief or poster) | A section keeps it one page. A PDF needs a file kept up to date. |
| How is the team named? | Team name + member names · team name only · member names only | Check what the program expects on capstone outputs. |
| Is the partner farm named? | Area only ("a partner farm in Sarangani") · farm name · not mentioned | Naming the farm needs the owner's permission. |
| Is CFLRS or the college mentioned? | In Thanks · in Who made it · not mentioned | Needs their agreement; the colors already come from the CFLRS logo. |
| Is Shrimp.io (the partner organization) mentioned? | One clear line that Farm.Shrimp.io is separate · not mentioned | Avoids readers assuming the two are connected. |
| What contact goes on the page? | A team email · the adviser's office · no contact for now | Someone must check it. On the farm network a mail link only opens the device's mail app. |
| What language? | English · English with Filipino or Cebuano | Match the farm staff who will read it. |

## Writing rules

The section should read in under a minute and match the minimal first screen.

- **About 150 words in total**, not counting the button. Cut anything a farm owner would skip.
- **Write for a farm owner, not the panel.** Say "what your technicians record at the ponds", not "multi-tenant data model". Spell out terms like FCR once, or leave them out.
- **Only what is true today.** No features that are planned but not built, no blockchain, no cloud or mobile app.
- **Short lines.** Sentences under 20 words; one idea per bullet.
- **Names only with permission.** People, the partner farm, CFLRS and the college all need a yes first.
- **Text, not images of text.** Logos or photos only if the team has the right to use them, and they are bundled with the app, since the farm network has no Internet.

## Next steps

- [ ] Team discusses the seven decisions and notes the answers in the table
- [ ] Ask permission from anyone named: partner farm, CFLRS or the college, adviser
- [ ] Fill in the template's brackets and delete unused lines
- [ ] Send the filled-in text to Claude to build: the Learn more button, the About section, and the second Create a farm account button
- [ ] Check it on a laptop and a tablet before it goes to main
