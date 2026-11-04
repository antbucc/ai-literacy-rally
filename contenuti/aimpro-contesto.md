# AIM-PRO: contesto per la generazione delle domande

Fonte: Deliverable D2.1 "AIM-PRO Foundational Framework" (pubblico, settembre 2026) e conoscenze consolidate sull'AI literacy.
Usare SOLO fatti presenti qui o conoscenze generali certe. Non inventare numeri, date o nomi.

## Il progetto
- AIM-PRO = "AI Literacy for Multidisciplinary Professional Readiness and Outreach", progetto Erasmus+ cofinanziato dall'Unione Europea (GA 101245864), con il supporto svizzero di Movetia.
- Destinatari: Istruzione superiore (HE, università), Istruzione e formazione professionale (VET) e piccole e medie imprese (SME/PMI).
- Obiettivi: individuare gli ingredienti di scenari di apprendimento "green" e personalizzati per l'AI literacy; coinvolgere HE, VET, aziende ed esperti pedagogici nella co-progettazione.
- Un workshop di co-design si è tenuto a L'Aquila il 10 febbraio 2026 con 27 partecipanti divisi in 7 gruppi, con metodo design thinking: User Persona, Empathy Map, Need Summary.
- Personas: studente di informatica, studente d'arte, dottorando, docente universitario, HR Director, HR Manager, formatore VET, docente VET.
- Quattro temi trasversali emersi dalle empathy map: (1) potenziamento, non sostituzione: le persone vogliono restare loro a decidere; (2) trasparenza: gli output dell'AI devono avere spiegazioni e indicatori di qualità; (3) tempo: la formazione deve essere modulare, breve e subito applicabile; (4) riconoscimento: certificati, incentivi, valore per la carriera.
- Otto dimensioni dei bisogni: controllo umano; fiducia e trasparenza; usabilità ed efficienza; personalizzazione e flessibilità; sviluppo professionale e riconoscimento; motivazione e gestione del cambiamento; comunità ed ecosistema; strumenti e infrastrutture.

## Le competenze di AI literacy
- Il catalogo AIM-PRO contiene 104 competenze attive, divise in 4 categorie: Digital (26), Green (25), Resilience & Entrepreneurial (27), Deep Tech (26).
  - Digital: AI literacy, interazione con l'AI, valutazione degli output, dati, uso responsabile, consapevolezza normativa.
  - Green: impatto ambientale dell'AI, efficienza delle risorse, pratiche di AI sostenibile.
  - Resilience & Entrepreneurial: adattamento, collaborazione, innovazione, rischio, imprenditorialità, uso organizzativo dell'AI.
  - Deep Tech: machine learning, reti neurali, ingegneria, deployment (messa in produzione), MLOps, Digital Twin.
- Dalle 6 fonti sono stati estratti circa 130 elementi, poi armonizzati.
- Fonti principali: DigComp 2.2 / 3.0 (UE), framework di AI literacy OCSE/Commissione Europea, framework UNESCO di competenze AI per studenti, Digital Promise, Long e Magerko (2020), Chiu. Strumenti complementari: GreenComp (sostenibilità), EntreComp (imprenditorialità), AI Act (regolamento UE 2024/1689).
- Ogni competenza ha: categoria, orientamento KSA (Knowledge, Skills, Attitudes = conoscenze, abilità, atteggiamenti), livello (Foundation, Intermediate, Advanced), rilevanza per HE, VET e SME.
- Livelli: Foundation = riconoscere concetti di AI e usarla con guida; Intermediate = usarla in autonomia e valutarne criticamente gli output; Advanced = progettare, configurare o supervisionare soluzioni AI.
- Le competenze si raggruppano in "cluster" (40 cluster in 8 domini) usati per valutazione e certificazione. Esempio: cluster P8 "Prompting e uso multimodale strutturato", con concetti come struttura del prompt, role prompting, few-shot, messaggi di sistema, vincoli di formato, raffinamento iterativo.
- Gli 8 domini: fondamenti di AI e definizione dei compiti; dati e machine learning classico; deep learning e architetture; AI generativa e uso fondato su fonti; AI responsabile, legale e sicura; flussi di lavoro professionali con l'AI; agenti AI e supervisione umana; modelli operativi, sostenibilità e adattamento continuo.
- I prerequisiti tra cluster possono essere obbligatori, consigliati o co-requisiti.

## Strategie didattiche (iSQD)
- Esempi di strategie: costruire conoscenze sull'AI, esplorazione guidata (scaffolding), atteggiamenti e convinzioni, negoziazione dei ruoli, valutazione degli output, discussione riflessiva, co-creazione con l'AI, prompting iterativo, didattica integrata con l'AI, esperienze autentiche.
- Caso d'uso "Elena": HR Director prudente e con poca fiducia nell'AI, il cui team deve usare l'AI per lo screening dei candidati. Il percorso è di 240 minuti in 2 moduli: prima Elena impara (da studente), poi guida il team (da docente).

## Il framework tecnico (Model-Driven Engineering)
- AIM-PRO usa l'ingegneria guidata dai modelli (MDE): i concetti sono descritti in meta-modelli precisi, tracciabili e leggibili dalle macchine.
- Gli strumenti: la piattaforma open source Jjodel (Università dell'Aquila), con l'assistente Jjodie che genera modifiche ai modelli come script da rivedere prima di eseguirli.
- 8 meta-modelli: Scenario, Competencies, Certification Design, Activities, Resources, iSQD, Educators, Users.
- Uno scenario contiene fasi, moduli, obiettivi (CompetencyGoal o ClusterGoal) e valutazioni; le fasi possono essere sequenziali o parallele (percorsi personalizzati).

## Green AI e sostenibilità
- L'energia si misura in wattora (Wh); le emissioni in grammi di CO2 equivalente.
- Emissioni = energia consumata x intensità carbonica della rete elettrica (gCO2/kWh), che cambia in base al paese e all'ora del giorno. La stessa energia produce meno CO2 su una rete idroelettrica (es. Norvegia) che su una rete a carbone.
- Strumenti di misura: CodeCarbon, contatori hardware Intel RAPL, powermetrics su Apple Silicon. Strumenti diversi possono dare valori diversi sullo stesso carico.
- PUE (Power Usage Effectiveness) misura l'efficienza di un data center: energia totale / energia dei server; 1,0 sarebbe l'ideale.
- Lo standard Software Carbon Intensity (ISO/IEC 21031) separa l'energia dall'intensità carbonica.
- Pratiche sostenibili: scegliere il modello più piccolo adeguato al compito, evitare rigenerazioni inutili, preferire data center con energia rinnovabile, misurare prima di ottimizzare, riusare modelli già addestrati.
- L'addestramento di un grande modello consuma molta energia una volta sola; l'inferenza (l'uso quotidiano) consuma meno per richiesta ma si moltiplica per milioni di richieste.

## Fatti generali certi sull'AI (utilizzabili)
- Un LLM genera testo prevedendo il token successivo; può produrre "allucinazioni", cioè affermazioni false ma plausibili.
- Bias: un modello addestrato su dati sbilanciati riproduce e può amplificare lo squilibrio.
- AI Act (Regolamento UE 2024/1689): approccio basato sul rischio (rischio inaccettabile = vietato; alto rischio; rischio limitato con obblighi di trasparenza; rischio minimo). Entrato in vigore il 1° agosto 2024. Dal 2 febbraio 2025 si applicano i divieti e l'obbligo di AI literacy (articolo 4). Sono pratiche vietate, tra le altre, il social scoring e il riconoscimento delle emozioni sul luogo di lavoro e a scuola (salvo motivi medici o di sicurezza). Selezione del personale, istruzione (per esempio valutazione degli studenti) e credito sono ad alto rischio. Le sanzioni massime per le pratiche vietate arrivano a 35 milioni di euro o al 7% del fatturato mondiale annuo.
- I chatbot devono dichiarare di essere un'AI (obbligo di trasparenza); i deepfake vanno etichettati.
- GDPR: i dati sanitari sono "categorie particolari"; principio di minimizzazione dei dati.
- Supervisione umana (human oversight / human in the loop): una persona deve poter controllare e correggere le decisioni dell'AI.
- Ciclo di vita del machine learning: definizione del problema, raccolta dei dati, preparazione dei dati, addestramento, valutazione, messa in produzione (deployment), monitoraggio.
- Apprendimento supervisionato = dati etichettati; non supervisionato = trovare gruppi senza etichette; per rinforzo = premi e penalità.
- Overfitting = il modello impara a memoria i dati di addestramento e generalizza male.
- RAG (Retrieval-Augmented Generation) = il modello cerca in documenti affidabili prima di rispondere, per ridurre le allucinazioni.
- Un agente AI può usare strumenti e compiere azioni; serve supervisione umana sulle azioni importanti.
- I rilevatori di testo AI sono poco affidabili.
