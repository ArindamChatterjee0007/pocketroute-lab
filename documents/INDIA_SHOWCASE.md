# India Showcase Brief

Verified October 30, 2026. A practical shortlist for a Bengaluru-based independent engineer. No registration, payment, proposal submission, travel booking or company contact has been made. No fully funded showcase slot was verified. Event pages can change; confirm details before committing.

## The Recommendation

Prioritise a real speaking/demo route over a paid attendee pass. The strongest immediate fit is The Fifth Elephant's Hyderabad call: it explicitly welcomes small-model experiments, working examples and findings from systems that did not reach production. Its proposal deadline is October 31, 2026, with no cutoff time zone stated. Treat it as urgent, not as a guaranteed slot.

For Bengaluru, the Tech Summit poster route is concrete but paid after selection, with individual affiliation eligibility and the deadline still needing confirmation. Its general conference ticket is attendance, not permission to demonstrate a project. With INR 0 new spend, prepare the proposal and ask for terms; do not buy a pass merely because large companies sponsor the event.

## Hyderabad: Best Immediate Speaking Fit

**The Fifth Elephant: After the Prototype. Event November 28, 2026. Proposal deadline October 31, 2026.**

The official call offers 45-minute talks with demos, 30-minute talks without demos, and 15-minute flash/quick-demo talks. It welcomes fine-tuning, quantization and small language models, including Qwen-based classification. It explicitly accepts work that stopped short of production when the speaker can explain what was learned.

Proposed format: a 15-minute evidence-led walkthrough. Individual practitioners are not excluded by the call; no incorporation/student requirement is stated. Submission is through the organiser's proposal page and may require an account. No proposal fee is stated, but that is not proof of free attendance. Venue, speaker-ticket terms, travel, hotel reimbursement and compensation were not stated in the reviewed call. Obtain written confirmation before travel or accepting costs.

This is a technical community opportunity, not a confirmed audience of large-company recruiters. No hiring, project offer or paid speaking commitment exists.

Official call: https://hasgeek.com/fifthelephant/hyd-meetup-cfp/

## Bengaluru: Poster And Industry Access

**Bengaluru Tech Summit, November 17-19, 2026, BIEC, 09:00-18:00 local time.** Embedded World India is co-located.

The live poster form asks for an abstract of at most 250 words, an extended-abstract PDF of at most 5 MB using the organiser template, and one presenter. The form requires an Institution/Organisation affiliation; eligibility for an unaffiliated independent engineer is not explicit. Do not invent an institution or imply employer sponsorship. The deadline was not shown in the reviewed form.

The displayed one-attendee total is **INR 4,254 if selected**, comprising INR 3,500 base, INR 630 GST and INR 124 processing. Selection requires later payment to confirm participation, and submission includes permission to publish the abstract/poster. These are approval gates, not free access.

Separately, the Silver conference pass is advertised at INR 4,000 plus 18% GST through November 1, 2026. It includes conference/exhibition and B2B-networking access, not an accepted poster, booth or speaking slot. Other visitor routes may exist, but no free independent showcase was verified.

The current 2026 organiser page lists Infosys, Bosch Global Software Technologies, SAP, Micron, Applied Materials, Cloudflare, Qualcomm, Intel and Dell among sponsors. Current speakers include representatives of NXP and Lam Research. This establishes ecosystem presence, not a meeting, hiring intention or interest in this project.

Poster form: https://bengalurutechsummit.com/bts-2026/public/poster/register

Conference/pass terms: https://www.bengalurutechsummit.com/conference.php

Current edition and industry listings: https://www.bengalurutechsummit.com/

## India And Remote Alternatives

| Route | Timing and practical value | What remains unconfirmed |
| --- | --- | --- |
| T-Works Hyderabad | Ongoing hardware/prototyping access; official page includes individual innovators | Not a dated showcase or speaking invitation. Programme fees, equipment access and sponsorship need enquiry. |
| FOSS Meetup Delhi/Noida | November 14, 2026, 15:30-18:00 at Essentia, Sector 62; official page shows a live CFP | Deadline, independent speaker eligibility, remote option, ticket terms and travel support not established. Not a zero-cost trip from Bengaluru. |
| EFY Expo Gujarat | December 3-5, 2026, Gandhinagar; a free visitor pass is advertised | Free expo/keynote access is not a booth or demo slot. Conferences/workshops and travel are separate. No individual free showcase verified. |
| EFY Expo Pune | January 21-23, 2027, Auto Cluster, Pune; free visitor route advertised | Current speaking CFP/booth fees and no-cost showcase eligibility not verified. Prior-edition speakers are not current commitments. |
| India Electronics Week | May 5-7, 2027, Bengaluru; more time to build a measured hardware demonstration | Organiser calendar verifies dates, not a speaking slot, waived booth or funding. |
| LF Edge contribution | Remote, ongoing; participation described as open to all | Concrete project issue/meeting must be selected. Open contribution is not automatic working-group admission or a presentation booking. |
| EDGE AI livestreams | November 3, 10 and 24, 2026; public viewing and Q&A | Audience access, not an open demo call. Exact broadcast times need checking. |

Sources: https://tworks.telangana.gov.in/ ; https://fossunited.org/c/delhi/nov-26 ; https://gujarat.efyexpo.com/ ; https://pune.efyexpo.com/ ; https://www.efyexpo.com/ ; https://lfedge.org/resources/get-involved/ ; https://www.edgeaifoundation.org/livestreams

## What To Showcase Honestly

Working title: **Before the Native Port: What a Small-Model Routing Experiment Gets Wrong.**

Show the real Node/Linux classifier, the 96-case regression inputs, separate expected answers, the report validator and the recorded failure analysis. The measured result is 73/96 (76.0%), with four unsafe acceptances. The model plus reject-only policy is a hybrid system; it is not newly trained specialists or a production-ready phone/watch/MCU engine. There are no physical-device energy measurements.

A useful demo runs the report scorer on a clearly labelled fixture, shows that missing/invalid attempts fail, and explains why matching a flawed reference is not release acceptance. Do not replay cloud outputs and describe them as live on-device inference. A stronger future demo requires a real offline native path on an owned/authorised device, measured memory/latency/cancellation and a valid energy method before any battery claim.

Suggested 15-minute structure:

1. Two minutes: the bounded offline task and device constraints.
2. Four minutes: the real evaluation, development-versus-confirmation gap and unsafe outcomes.
3. Five minutes: the regression kit, deliberately incomplete report and preserved failure evidence.
4. Three minutes: device adapter contract, current blockers and what physical qualification must prove.
5. One minute: request technical critique or a scoped collaboration, not production adoption.

## Proposal Draft For Human Review

The following is an unsubmitted draft, not an accepted abstract:

PocketRoute Lab explores a bounded question: what must be verified before a small language-model classifier becomes a credible device integration? We evaluated a pinned Qwen2.5 1.5B model with constrained outputs and a reject-only policy. Development performance reached 46/48, but a separate AI-authored synthetic set produced 73/96 correct labels and four unsafe acceptances. We did not ship this as a reliable native product. This session explains the failed alternatives, the difference between schema validity and correctness, and a portable regression kit that retains timeouts, missing cases and unsafe outcomes. A short scorer demonstration shows why exact reproduction of a failing reference is not acceptance. Attendees will leave with a practical contract for model provenance, cancellation, device-specific budgets and honest evidence boundaries. The work currently runs in Node/Linux; phone, watch and MCU ports and energy claims remain unvalidated.

Authors must verify the draft, disclose AI assistance where required and obtain all co-author/IP permissions before submission. No employer endorsement, startup incorporation or physical-device result is implied.

## Questions Before Accepting A Slot

1. Are independent individual engineers eligible, and is the proposed evidence/failure-analysis topic within scope?
2. Is the slot a talk, poster, live demo, booth or attendance-only pass? What exactly is included?
3. Is there any proposal, registration, publication, booth, equipment or mandatory membership fee?
4. Is travel/accommodation prepaid, reimbursed or unsupported? Reimbursement requiring upfront spending does not meet the current INR 0 constraint.
5. Can the session be remote, or must the speaker attend? Is there a recording/publication licence and can it be reviewed first?
6. What are the exact deadline, time zone, selection process and cancellation obligations?

No arrangement exists until the organiser confirms the terms and the founder approves them. Domestic travel avoids an international visa requirement, but transport, lodging and time still cost money. A venue's visa-information page is not visa sponsorship or paid travel.

## Industry Strategy And Exclusions

Use the artifact to demonstrate engineering judgement: reproducible builds, honest failures, runtime boundaries and meaningful tests. Ask for technical critique and a bounded feasibility discussion on the other team's device/data. Keep job applications, research collaboration and customer contracts as separate outcomes. No event or paper guarantees a role or project with a large company.

Do not prioritise overseas Munich under the present budget: its March 18-19, 2027 talks are in person only, and no travel/visa/hotel support was verified. The Bengaluru Fifth Elephant Winter CFP closed October 11; attendance is not a late speaker acceptance. Startup PODs, booths and startup-only accelerators are not automatically available to an unincorporated individual. Do not reuse last year's corporate speakers as this year's programme.

## Research Provenance

Two read-only research requests were made using the requested Claude Fable 5.1 and GPT-6 Astra routes; their runtime model identities were not independently attested. Their regional findings were reconciled and decisive Hyderabad/Bengaluru/Delhi/T-Works terms were checked against primary pages. No private correspondence was read and no external action was taken.

This brief is a dated decision aid, not exhaustive market research or a promise of compensation. Recheck near-term calls before acting, especially the Hyderabad October 31 deadline.