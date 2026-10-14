**English** · [中文](chinese-official-titles-outline.zh-CN.md)

# Chapter Outline — *A History of Chinese Official Titles*

A ~108,000-character Chinese-language textbook. Organized thematically (each theme traced across all dynasties), with dynasty-by-dynasty reference tables in the appendices.

*Note: official titles are given as pinyin + Chinese characters + English gloss, since a pure English rendering loses the precision the book depends on.*

![Chapter 1: the inner/outer court cycle](../assets/guanzhi/ch01-inner-outer-cycle.png)

**↑ The first figure in the book, and the most important.** The upper half is the mechanism; the lower half is the five historical rounds — each round's "new attendants" are the successors of the very body the previous round hollowed out. Chapters 3–6 unpack four of these rounds. All 23 figures in the book follow this specification.

---

## The Book's Argument

Changes in official titles are not mere renaming. They are **fossils left by the repeated struggle between imperial autocracy and the bureaucracy**. Three mechanisms run through the entire book; every chapter must close by explicitly invoking at least one:

1. **The inner court devours the outer court** — attendants gain power through proximity → the body is formalized into a regular office → bureaucratization distances it from the emperor → the emperor turns to a new set of attendants. The chain: Shangshutai 尚書臺 → Zhongshu-Menxia 中書門下 → Hanlin Academicians 翰林學士 → Grand Secretariat 內閣 → Grand Council 軍機處
2. **Commissions devour substantive office** — name and reality separate; rank-office (benguan 本官), functional office (zhishi 職事), and commission (chaiqian 差遣) run on independent tracks. Cases: lu shangshu shi 錄尚書事, tong zhongshu menxia pingzhangshi 同中書門下平章事, Song "salary-rank offices" 寄祿官
3. **Division and mutual check** — one post split among several men; multiple agencies constraining one another. Cases: the Two Bureaus and Three Fiscal Commissions 二府三司, canzhi zhengshi 參知政事, the parallel appointment of governors and governors-general 督撫並置

**Success criterion**: after finishing the book, a reader should be able to take these three keys and explain, unaided, any official title the book did not cover.

**Explicitly out of scope**: the administrative systems of the Western Xia, Tibetan, and Nanzhao regimes; salary figures and establishment quotas; textual criticism of sources and scholarly controversies.

> **Revised 2026-07-29**: Liao, Jin, and Yuan administration was originally excluded; it is now brought back in and merged with the Qing as Chapter 15, "Dual Administration." The reasoning is at the head of that chapter. What was brought back is a *theme*, not a *dynasty* — there is no "Yuan chapter," since that would break the thematic organization.

---

## Diagram Policy

**Wherever a diagram is possible, use one.** Figures run on a **dual track**:

- **Source**: mermaid, stored at `assets/guanzhi/<name>.mmd`. Greppable, editable, diffable; renaming one office does not require redrawing
- **Output**: rendered locally to PNG and committed alongside in `assets/guanzhi/`; the prose references the PNG via `![]()`

Because the prose references the PNG, **every reading surface shows the figure**, regardless of mermaid support (the review station currently has none). The source stays in the repo for maintainability. Render command: `npx @mermaid-js/mermaid-cli -i x.mmd -o x.png -b white -s 3`.

The rule: **diagram the mechanisms, tabulate the names.** Anything involving "who controls whom," "where the paperwork goes," or "who hollowed out whom in this round" gets a diagram; flat lists of terms get a table. At least one figure per chapter.

### Figure list by chapter

| Ch. | Figure | Type |
|---|---|---|
| 1 | **The inner/outer court cycle** — one loop with five historical instances tagged on it (Shangshutai / Zhongshu-Menxia / Hanlin academicians / Grand Secretariat / Grand Council). The first and most important figure in the book | cycle |
| 1 | Relationship among rank-office, functional office, and commission | relations |
| 2 | The Three Excellencies in three stages: Qin–Han → late Western Han → Eastern Han | evolution |
| 3 | **Document flow through the Shangshutai** — memorials up and edicts down share one channel; the diagram shows why the chokepoint is fatal | flow |
| 4 | Three Departments document flow: Secretariat drafts → Chancellery reviews → State Affairs executes (with the rejection arrow) | flow |
| 4 | Evolution of the councillor title: department heads → *tong sanpin* → *tong pingzhangshi* | evolution |
| 5 | Song Two Bureaus and Three Fiscal Commissions | structure |
| 5 | The threefold split unpacked: one real title annotated field by field | breakdown |
| 6 | **Drafting vs. vermilion endorsement** — how Grand Secretariat and Directorate of Ceremonial check each other | structure |
| 6 | Ming–Qing central evolution: Secretariat → (abolished) → Grand Secretariat → Grand Council | evolution |
| 7 | The Qin commandery's threefold split: administrator · commandant · inspector | structure |
| 8 | **The four-round cycle of inspectors becoming administrators** — *cishi*, *jiedushi*, and governors-general each run the same loop. The single figure the book most needs | cycle |
| 9 | Provincial hierarchy: Yuan branch Secretariat → Ming three commissions → Qing governors-general above them | evolution |
| 10 | Migration of recruitment authority: local magnates → rectifiers → central examinations | evolution |
| 11 | **One official on four coordinate systems** — take a real title string from a source and label which field is salary, which is duty, which is honor | breakdown |
| 12 | Censors and remonstrators: two tracks (downward / upward) and their Song merger | relations |
| 13 | The public/private fiscal split: Grand Minister of Agriculture / Privy Treasurer → Ministry of Revenue / Imperial Household Department | structure |
| 13 | Song separation of mobilization from command: Bureau of Military Affairs ↔ Three Commands | structure |
| 14 | Ming Grand Secretariat vs. Directorate of Ceremonial (same figure as Ch. 6, viewed from the eunuch side) | structure |
| 15 | **Four answers to one problem** — Liao dual northern/southern administration, Jin *meng'an mouke*, Yuan four-class order and *darughachi*, Qing paired Manchu-Chinese appointments, side by side | comparison |
| 15 | Yuan single-department government vs. the Tang–Song Three Departments | comparison |
| 16 | Six Ministries → eleven ministries, side by side | comparison |
| App. A | Six structural trees: Qin–Han / Tang / Song / Yuan / Ming / Qing | tree |

A finished sample appears at the top of this document (the Chapter 1 cycle figure); its source is at `assets/guanzhi/ch01-inner-outer-cycle.mmd`.

---

# Part One — General Principles

## Chapter 1. Three Keys to Reading an Official Title (5,000 chars)

1. **Three parallel systems**: rank-office (fixes grade and salary), functional office (fixes actual duties), commission (fixes temporary authority). Use the Tang–Song contrast between "salary-rank office" and "commission" to show the three can decouple entirely. Example: in Song, *shangshu youpuye* 尚書右僕射 fixed the salary; *tong zhongshu menxia pingzhangshi* was what made a man an actual chief councillor
2. **The inner/outer court cycle**: give the full chain and the mechanism; details of each link are deferred to Chapters 3–6
3. **Name/reality separation**: the *taiwei* 太尉 was nominally supreme military commander yet rarely held actual troops; the *cishi* 刺史 began as a 600-*shi* inspector and ended as a regional governor
4. **A four-step test for the reader**: Which system does this title belong to? Did it originate in the inner or outer court? How far has its literal meaning drifted from its actual duties? Does it have a colleague split off from it?

**Boundary**: this chapter is methodological. No detailed institutional narrative for any dynasty — one-sentence illustrations only.

---

# Part Two — The Center: A Thousand Deaths of the Chief Councillor

## Chapter 2. From Household Servant to Head of the Bureaucracy (7,000 chars)

1. **Etymology**: *zai* 宰 was a household steward, *xiang* 相 an assistant at ritual, *yin* 尹 an administrator. All three moved from private service to public office — the general pattern of bureaucratic origins
2. Spring and Autumn / Warring States: the Qi *xiang*, the Chu *lingyin* 令尹, the Qin *shuzhang* 庶長 and *xiangbang* 相邦
3. **The Qin–Han Three Excellencies**: division of labor among *chengxiang* 丞相, *taiwei*, and *yushi dafu* 御史大夫. The *taiwei* was intermittently established and largely titular; in practice the government ran as a "two-office" structure of chancellor plus censor-in-chief
4. **The late Western Han reorganization**: *yushi dafu* renamed *da sikong* 大司空, *chengxiang* renamed *da situ* 大司徒; Emperor Wu had already created *da sima* 大司馬 as a prefix to generalships — yielding *da sima*, *da situ*, *da sikong*
5. **Eastern Han**: the *da* prefix dropped, fixing the titles as *taiwei*, *situ*, *sikong*. The *taiwei* assessed military affairs, the *situ* civil administration and moral instruction, the *sikong* waterworks and construction
6. The first sign of the Three Excellencies' hollowing out: "though the Three Excellencies were established, affairs reverted to the Pavilion"

**Boundary**: stop at "the Three Excellencies have been hollowed out." The mechanism of the Shangshutai and the nature of *lu shangshu shi* both belong to Chapter 3.

## Chapter 3. The Inner Court's First Victory (7,000 chars)

1. **The Shangshu's origins**: a subordinate of the Privy Treasurer, ranked 600 *shi*, handling palace documents. The lowness of the starting point is the key
2. Emperor Wu's inner/outer court: to bypass the outer-court chancellor, decision-making moved inward
3. Emperor Guangwu fixes the pattern: "governance was not entrusted downward — though the Three Excellencies were established, affairs reverted to the Pavilion"
4. **The power derives from being the sole document channel**: memorials going up must pass through the Shangshu; edicts coming down must pass through the Shangshu. Control both ends and you control policy. This mechanism recurs throughout the book and must be made fully explicit here
5. **Lu shangshu shi 錄尚書事**: not an office but an added commission. The substantive office might be Grand Mentor, General-in-Chief, or one of the Three Excellencies. The precedent is Huo Guang 霍光 governing as General-in-Chief *ling shangshu shi*
6. **Institutional consequence**: a child emperor ascends → "Grand Mentor *lu shangshu shi* + General-in-Chief *lu shangshu shi*" becomes the standard configuration → consort-clan domination. The eunuchs' counter-move was to use the Regular Palace Attendants to sever the Shangshutai's channel to the throne
7. The link between *lu shangshu shi* and usurpation: the shared precondition for Huo Guang, Liang Ji, Cao Cao, and Sima Yi

**Boundary**: the formation of the Three Departments belongs to Chapter 4. Eunuch institutions belong to Chapter 14 — here, only the fight over the channel.

## Chapter 4. The Three Departments and the Chancellery Hall (7,000 chars)

1. **Wei–Jin**: the Secretariat splits off from the Shangshutai; the Chancellery evolves from the Attendants' Office. The pattern: a new body of attendants once again hollows out an already-bureaucratized Shangshutai — round two of the inner court devouring the outer
2. **Sui–Tang crystallization**: the Secretariat drafts, the Chancellery reviews and rejects, the Department of State Affairs executes
3. **The Chancellery Hall** 政事堂: where the three department heads deliberated; Zhang Yue 張說 renamed it "Zhongshu-Menxia" and established its five sections
4. **Fragmentation of the councillor title**: the office of *shangshu ling* was left vacant because Emperor Taizong had once held it; "*tong zhongshu menxia sanpin*" took its name from the third rank of the Secretariat and Chancellery heads; later, when vice-ministers of junior standing entered the council, "*tong zhongshu menxia pingzhangshi*" was coined for them
5. **The key mechanism**: *pingzhangshi* carried no rank of its own — grade followed the substantive office. Low in status, heavy in power, revocable at will. This is the mature form of "commissions devouring substantive office"
6. **The contrast with lu shangshu shi**: one is command of an entire agency (concentrating power in one man); the other is a seat at a table (dispersing power among many). This contrast is the chapter's central argument

**Boundary**: Hanlin academicians and commissioners belong to Chapter 5. The examination system belongs to Chapter 10.

## Chapter 5. The Age of Commissions (7,000 chars)

1. **The rise of commissioners in the later Tang**: Hanlin academicians, called "inner councillors," siphon off the drafting authority of the Secretariat drafters — round three of the inner court devouring the outer
2. Military commissioners, salt-and-iron commissioners, transport commissioners: how commissions eroded the regular office structure
3. **The Two Bureaus**: the Bureau of Military Affairs 樞密院 handles the military, paired with Zhongshu-Menxia as the Western and Eastern Bureaus
4. **The Three Fiscal Commissions** 三司: salt and iron, funds, and revenue; their head was nicknamed "the fiscal chief councillor" 計相
5. **Canzhi zhengshi 參知政事**: deputy to the chief councillor. At first it "did not proclaim edicts, did not head the court file, did not hold the seal, and did not ascend the Chancellery Hall," at half a councillor's salary; only later was it ordered to share the Hall and rotate the seal, "so as to divide the chief councillor's power"
6. **The Song threefold split** of rank-office, honorary title, and commission: the rank-office fixed salary, the honorary title conferred prestige, and only the commission carried real duties. This is the origin of naming forms like "*zhi* [administering] such-and-such prefecture"
7. **The Yuanfeng reforms**: the Three Departments restored, *canzhi zhengshi* abolished; reinstated in the Southern Song

**Boundary**: the long history of fiscal agencies belongs to Chapter 13; here, only the Three Commissions' position in the central structure.

## Chapter 6. After the Chancellorship Was Abolished (7,000 chars)

1. **Ming Taizu abolishes the chancellorship**: following the Hu Weiyong case the Secretariat was dissolved and the Six Ministries reported directly to the emperor. A sixteen-century-old institution ends
2. **Formation of the Grand Secretariat**: Hall and Pavilion Grand Secretaries were appointed as advisors, ranked only fifth; under the Yongle emperor they entered the Wenyuan Pavilion to participate in confidential affairs. The Grand Secretariat never held formal councillor status — low-ranking attendants exercising a chief councillor's function, the most typical round of all
3. **Drafted rescripts and vermilion endorsement**: the Grand Secretariat drafted, the Directorate of Ceremonial endorsed. Imperial power split the decision in two so the halves would check each other
4. **The senior grand secretary**: Yan Song and Zhang Juzheng wielded great power, but that power came from personal imperial favor, not institutional guarantee — Zhang's posthumous disgrace proves the point
5. **The Qing Grand Council**: created for the northwestern campaigns. No fixed establishment, no dedicated offices, no clerical staff; grand councillors served concurrently by commission — the final form of the commission system
6. Under the Qing the Grand Secretariat is demoted to processing routine paperwork

**Boundary**: the history of eunuch institutions belongs to Chapter 14; the functions of the Six Ministries to Chapter 13.

---

# Part Three — Local Administration

## Chapter 7. Commanderies and Counties versus Enfeoffment (7,000 chars)

1. Local units under enfeoffment: the fiefs of lords and grandees were not administrative districts
2. **Origins of commandery and county**: counties were typically established on newly conquered land and reported directly to the ruler; commanderies began as frontier military zones, ranked below counties; by the Warring States the commandery had come to govern counties
3. **Qin abolishes enfeoffment for commanderies**: the debate between Li Si and Chunyu Yue. Each commandery had an administrator, a commandant, and an inspector — civil, military, and supervisory power split three ways: the earliest instance in the book of "division and mutual check"
4. **Parallel commanderies and kingdoms in the early Han**: after the Rebellion of the Seven States the kingdoms were reduced, then dismantled by the "Grace-Extending Decree"
5. Below the county: districts, hamlets, and wards, with their elders, bailiffs, and patrol chiefs
6. **The self-recruitment system**: administrators and magistrates were appointed by the center, but their subordinate staff were recruited by the officeholder personally — the key to understanding local power in the Han, and the soil from which the Nine-Rank system grew

**Boundary**: inspectors and the supervisory system belong to Chapter 8; recruitment to Chapter 10.

## Chapter 8. How Inspectors Became Administrators (7,000 chars)

This is the cleanest single thread in the book. The reader must see the same pattern recur four times: **the court dispatches inspectors → the inspectors take up permanent residence → residency lets them seize administrative power → they become formal regional heads → the court dispatches a new set of inspectors.**

1. **Cishi 刺史**: thirteen circuit inspectors established, ranked 600 *shi*, supervising 2,000-*shi* commandery administrators under "six articles of inquiry." That a low rank supervised a high one is the heart of the design
2. **Zhoumu 州牧**: inspectors were upgraded to governors at 2,000 *shi*; later senior officials were sent out as governors — the supervisory circuit became an administrative region, directly enabling the warlordism of the late Eastern Han
3. Area commanders and general managers: the localization of military office from Wei–Jin to Sui
4. **Jiedushi 節度使**: once they also held surveillance commissions they controlled troops, administration, and revenue together, producing the An Lushan rebellion and the provincial warlords
5. **The Song response**: prefects were checked by vice-prefects; and four circuit intendants — pacification, transport, judicial, and ever-normal granary — divided authority with no chain of command among them. Division and check taken to its limit, at the cost of administrative efficiency and frontier defense
6. **Ming–Qing governors and governors-general**: originally temporary imperial deputations, gradually made permanent, and under the Qing the fixed heads of provincial government — the last round of the same pattern

**Boundary**: provincial administration belongs to Chapter 9; the central Censorate to Chapter 12.

## Chapter 9. The Birth of the Province (6,000 chars)

1. **What "province" originally meant**: *xingsheng* is short for "branch Secretariat" — a field office of the central Secretariat, a commission rather than a territory
2. **Yuan provincial administration**: its heads bore the titles of chancellor and manager of governmental affairs — central office titles transplanted downward, direct evidence of its field-office character
3. From temporary to permanent: the field office hardens into a first-order administrative division, isomorphic with the pattern in Chapter 8
4. **The Ming three provincial offices**: the branch Secretariat was replaced by a Provincial Administration Commission, alongside Surveillance and Regional Military Commissions, dividing civil, judicial, and military authority. "Province" survived as the colloquial name
5. Ming–Qing governors-general overrode the three commissions — where Chapter 8's argument comes to rest
6. **Interlocking boundaries**: Yuan provincial borders deliberately cut across natural frontiers to forestall separatism

**Boundary**: the main line of governor/governor-general development is in Chapter 8; here, only the hierarchy between them and the three commissions.

---

# Part Four — Recruitment and Status

## Chapter 10. Hereditary Office · Recommendation · Nine Ranks · Examination (8,000 chars)

1. Hereditary office and hereditary emolument; the disruption of merit-based aristocratic ranks (Shang Yang's twenty degrees)
2. **Recommendation**: from edicts summoning the "worthy and upright" to the standing requirement that commanderies nominate the "filial and incorrupt." Categories included filial-incorrupt, flourishing talent, worthy-upright, and classicist. **The defect**: nominator and nominee formed a patron–client bond, producing networks of disciples and former subordinates
3. **The Nine-Rank system**: proposed by Chen Qun, with rectifiers in each prefecture grading men into nine ranks on which the Ministry of Personnel based appointments. Intended as a stopgap when wartime displacement had destroyed local reputation-assessment, it produced "no poor families in the upper ranks, no powerful clans in the lower" — the institutional basis of the great-clan order
4. **Examination**: the founding of the presented-scholar degree (the exact year is disputed and must be flagged). Tang regular and special examinations; the Song establishment of palace examination, name-concealment, and recopying — bringing recruitment fully under the throne
5. Ming–Qing eight-legged essays and the three-tier examination; abolition at the end of the Qing
6. **The through-line**: recruitment authority passes from local magnates → rectifiers → central examination organs. Imperial power progressively absorbs the channel by which the bureaucracy reproduces itself

**Boundary**: rank, grade, merit title, and nobility belong to Chapter 11; the late-Qing reforms to Chapter 16 — here only the abolition itself.

## Chapter 11. Rank, Grade, Merit Title, and Nobility (7,000 chars)

1. **The grain-measure system** (Han): status measured in salary grain — 2,000 *shi*, 600 *shi*
2. **The nine-rank scale** (from Cao Wei): nine ranks in eighteen degrees; fixed at thirty degrees under the Tang
3. **Prestige titles**: civil and military, conferring grade without duties
4. **Functional offices**: actual posts
5. **Merit titles**: rewards for military service; twelve degrees under the Tang
6. **Noble ranks**: prince, duke, marquis, earl, viscount, baron
7. **Song salary-rank offices**: the rank-office fixed salary alone, wholly detached from actual duties — the extreme case of name/reality separation. The Yuanfeng reforms replaced offices with grades
8. Qing: rank + honorary concurrent title + hereditary rank
9. **The crux**: an official sits simultaneously on four coordinate systems. Reading a source requires knowing which field is salary, which is duty, and which is honor. Give the reader a worked example

**Boundary**: no specific agencies; recruitment belongs to Chapter 10.

---

# Part Five — Specialized Systems

## Chapter 12. The Censorate (6,000 chars)

1. **Origins of the censor**: originally a recorder, converted to supervision under Qin and Han. Censor-in-chief → vice censor-in-chief → attendant censors
2. **Independent standing**: in the Eastern Han the vice censor-in-chief, the director of the Shangshu, and the metropolitan commandant sat alone at court, "the three who sit apart"
3. **The Tang Censorate's three courts**: headquarters, palace, and investigation
4. **Censors and remonstrators, apart and together**: censors supervised officials (downward) and remonstrators criticized the emperor (upward). In the Song the two merged and remonstrators too turned to impeaching officials — imperial power narrowing the upward channel of criticism
5. **The Ming "speaking officials"**: the Censorate plus the Six Offices of Scrutiny. The supervising secretaries could reject Six Ministry documents while ranked only seventh — another case of the low constraining the high
6. Under the Qing the Six Offices were absorbed into the Censorate, ending independent rejection authority
7. **The argument**: central censors never became administrators, because they had no territory, no subject population, and no revenue — the contrast with Chapter 8's inspectors shows that residency *plus resources* is what makes administrative capture possible

**Boundary**: local supervisory development is in Chapter 8; used here only for contrast.

## Chapter 13. Finance and the Military (7,000 chars)

**The fiscal line**

1. Qin–Han: the Grain Intendant becomes the Grand Minister of Agriculture (state finance), split from the Privy Treasurer (imperial household finance) — **the distinction between state treasury and privy purse is the first principle for understanding premodern Chinese finance**
2. Tang: the Ministry of Revenue operating alongside commissioners
3. Song: the Three Fiscal Commissions, their head the "fiscal chief councillor"; folded into the Ministry of Revenue at the Yuanfeng reforms
4. Ming–Qing Ministry of Revenue; the Qing Imperial Household Department handling imperial finance (a return to the public/private split)

**The military line**

5. Qin–Han: *taiwei*/*da sima* (titular), guards commandant (palace gates), metropolitan commandant (the capital), commandery levies and conscripts
6. Wei–Jin–Northern and Southern Dynasties: area commands and hereditary military households
7. Sui–Tang **militia system** (twelve guards and assault-resisting garrisons); its decay forced a shift to mercenary recruitment, producing the provincial warlords
8. Song: the Bureau of Military Affairs held mobilization authority while the Three Commands held the troops — **deployment separated from command**, a textbook case of division and check, at the cost of "soldiers who do not know their general and generals who do not know their soldiers"
9. Ming garrison system and the Five Chief Military Commissions (the commissions held the registers, the Ministry of War the mobilization orders — the same separation)
10. Qing Banners and Green Standard; the Ministry of War reduced to a documentary agency

**Boundary**: no campaign narratives; the military authority of governors-general belongs to Chapter 8.

## Chapter 14. The Palace and the Eunuchs (5,000 chars)

1. **Source of power**: eunuchs belonged to the palace service system, and all their power derived from proximity to the emperor — the inner-court mechanism in its purest form
2. **Eastern Han**: regular palace attendants and yellow-gate attendants; eunuch participation in coups, the enfeoffment of the five marquises, the Partisan Prohibitions
3. **Tang**: the Palace Domestic Service; after Emperor Suzong, eunuchs held the military commissions and the Divine Strategy Army commands — **eunuch control of the palace armies was the material basis for deposing and enthroning emperors in the late Tang**
4. **Song**: two palace service departments under systematic suppression; the least eunuch trouble of any major dynasty
5. **Ming**: the twenty-four agencies, with the Directorate of Ceremonial holding vermilion endorsement and the Eastern Depot — paired against the Grand Secretariat's drafting authority (recalling Chapter 6)
6. **Qing**: the Imperial Household Department replaces the eunuch system; the Office of Respectful Service; an iron tablet forbidding eunuch involvement in government
7. **The argument**: eunuch power varies *directly* with the strength of imperial autocracy, not inversely — eunuchs flourished precisely in the dynasties of concentrated imperial power, because they were an extension of that power, not a rival to it

**Boundary**: no consort or consort-clan institutions; no narrative of specific coups, only institutional position.

## Chapter 15. Dual Administration: Government Under the Conquest Dynasties (8,000 chars)

**Why a theme and not a "Yuan chapter"**: Liao, Jin, Yuan, and Qing all faced the same problem — **how a minority people governs an agrarian majority**. The four gave four different answers; only by setting them side by side does it become visible that these are one class of institutional design. Cut dynasty by dynasty, the pattern dissolves. The Yuan is simply the most systematic of the four answers. The Qing banner system appears in Chapter 13 as a military institution; this chapter takes up its other face, as an instrument of ethnic rule.

1. **The shared problem**: preserve the conquering people's military organization while taking over a mature Chinese-style bureaucracy. Two populations, two sets of rules — duality follows necessarily
2. **Liao**: the **Northern and Southern Administrations** — the Northern governed the tribal encampments, the Southern the Chinese prefectures and counties: "govern the Khitan by Khitan institutions, treat the Chinese by Chinese institutions." Real power sat with the seasonal imperial camp (*nabo*), while the Southern offices were largely ornamental — the ethnic version of the inner court devouring the outer
3. **Jin**: the **meng'an mouke** (a tribal unit fusing military, administrative, and productive functions) running parallel to Chinese-style prefectures; after the move to the central capital, sinicization gradually merged the two tracks into one
4. **Yuan** (the core of the chapter)
   - **Kheshig** (imperial guard): the steppe version of the inner court. Senior Secretariat officials were largely drawn from it — the emperor's household retainers converted directly into ministers of state, replaying Chapter 2's "from household servant to head of the bureaucracy" fifteen centuries later
   - **Single-department government**: the Chancellery abolished, the Department of State Affairs intermittently restored and abolished, all three merged into the Secretariat. The exact inverse of the Tang–Song design — a conquest regime wants efficiency, not mutual check
   - **Provincial administration**: see Chapter 9; here only its relation to single-department government
   - **The four-class order and "roots"**: ethnic category and origin capped how high one could rise — a bloodline threshold parallel to, but distinct from, the Nine-Rank system
   - ***Darughachi***: a Mongol or *semu* overseer installed above the Chinese nominal head at every level of administration. **This is the book's most naked case of "division and mutual check" — but what is being checked is not an overmighty bureaucrat, it is the governed majority**
   - The Commission for Buddhist and Tibetan Affairs and the pacification commissions: separate systems for religion and the frontier
5. **Qing**: **paired Manchu–Chinese appointments** (one Manchu and one Chinese minister and vice-minister in each of the Six Ministries), the banner system, the Court of Colonial Affairs, and the Manchu-language document channel in the Grand Council. Parity on the surface; real authority with the Manchus
6. **The argument**: dual administration transposes "division and mutual check" from the axis of *power* to the axis of *ethnicity*. It is equally effective and equally costly — excluding half the population from the highest offices by institutional design also means forfeiting their loyalty by institutional design

**Boundary**: provincial administration is Chapter 9; the banner military system is Chapter 13; the Grand Council is Chapter 6. This chapter does not treat those institutions themselves, only their ethnic dual-track character. Western Xia, Tibet, and Nanzhao are excluded.

---

# Part Six — Conclusion

## Chapter 16. The Late Qing Reforms and the End of the System (7,000 chars)

1. The final form of the traditional system: center (Grand Council–Grand Secretariat–Six Ministries) and locality (governors-general and the two provincial commissions)
2. **The Zongli Yamen**: the first agency that did not fit the traditional pattern — itself a commission in character, since all its ministers served concurrently
3. The Zongli Yamen becomes the Ministry of Foreign Affairs, ranked ahead of the Six Ministries
4. **The Bingwu reorganization**: the Six Ministries restructured into eleven; the Court of Judicial Review becomes the Supreme Court
5. **The responsible cabinet** (the "imperial-clan cabinet") is formed and the Grand Council and old Grand Secretariat abolished together — a two-thousand-year institutional order formally ends
6. **The change of vocabulary**: from *shangshu*/*shilang* to *dachen*/*ciguan* to *buzhang*/*cizhang*. A title stops naming *what one is to the emperor* and starts naming *what one is responsible for* — the endpoint of the book's argument: the bureaucracy finally sheds its dependence on personal relation to the throne
7. Coda: residual forms of the three mechanisms in modern bureaucracy

---

# Appendices

- **A. Structural charts by dynasty** — Qin–Han / Tang / Song / Yuan / Ming / Qing, one mermaid tree each, with a rank table alongside
- **B. Rank concordance** — Han grain-measure / Tang nine-rank / Song / Ming / Qing, aligned horizontally
- **C. Index of official titles** — title / dynasty / chapter location / predecessor and successor
- **D. Common misreadings corrected** — Was the *taiwei* the supreme military commander? Was a *cishi* a high official? Was "chief councillor" an office title? Did the Department of State Affairs have a serving head? Was a grand secretary a chief councillor? Was the Nine-Rank system a system of ranks? Was the Grand Council a formal agency?
- **E. Guide to sources and further reading** — primary sources / modern surveys / reference works
