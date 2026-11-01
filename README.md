# PokéroleDex 3.0 | Web-App & SQLite Database

Applicazione web e database relazionale SQLite basati sui dati ufficiali di **Pokérole TRPG (Core 3.0)**, con interfaccia ispirata a `pokeroledex.nl`.

---

## ⚡ Avvio Rapido (Zero Configurazione)

Il progetto è progettato per funzionare immediatamente, **anche per chi non ha esperienza con Python** o per computer privi delle librerie necessarie:

### Su Windows:
Basta fare doppio clic sull'eseguibile nella cartella principale:
* **`Pokeroledex.exe`** (Eseguibile Windows con rilevamento e avvio con un clic)
* oppure **`AVVIA_POKEROLEDEX.bat`** (Script batch di avvio rapido)

L'esecutore:
1. Rileva automaticamente l'interprete Python sul computer (o guida l'installazione automatica se assente).
2. Installa automaticamente le dipendenze mancanti da `requirements.txt`.
3. Inizializza il database SQLite dai JSON se assente.
4. Avvia il server e **apre automaticamente il browser** all'indirizzo [http://127.0.0.1:5000/](http://127.0.0.1:5000/).

### Su Linux / macOS:
Esegui dal terminale:
```bash
chmod +x start.sh
./start.sh
```

---

## 📁 Struttura del Database SQLite (`DB/pokeroledex.sqlite`)

Tutti i dati JSON presenti in `Storage/v3.0/` sono stati importati fedelmente secondo la specifica **`DDL.md`**:

| Tabella SQLite | Descrizione | Record Importati |
| :--- | :--- | :--- |
| **`pokedex`** | Specifiche Pokémon, attributi base/max, abilità, categorie, tag, dimensioni | **1.200** |
| **`pokedex_evolutions`** | Catena evolutiva relazionale con requisiti (Livello, Strumento, Stat, Mega) | **1.253** |
| **`pokedex_moves`** | Learnset relazionale (mosse apprese per rango: Starter, Rookie, Standard...) | **25.438** |
| **`moves`** | Database mosse (Tipo, Categoria, Potenza, Riserva Danno, Precisione, Effetti) | **892** |
| **`abilities`** | Abilità con regole ufficiali di gioco ed effetti descrittivi | **305** |
| **`items`** | Strumenti (HeldItems, TrainerItems, EvolutionItem, Medicine, Pokeballs, prezzi PMD) | **236** |
| **`natures`** | 25 Nature con punteggio di Fiducia (Confidence), parole chiave e guida al GDR | **25** |

Lo schema SQL completo e indicizzato è consultabile in [`DB/schema.sql`](file:///c:/Users/chrit/Desktop/Pokeroledex/DB/schema.sql).

Lo script di importazione riutilizzabile si trova in [`Back-End/importer.py`](file:///c:/Users/chrit/Desktop/Pokeroledex/Back-End/importer.py):
```bash
python Back-End/importer.py
```

---

## 🎮 Funzionalità della Web-App

1. **Pokédex Completo (1.200 Specie)**:
   - Ricerca live istantanea per Nome, N. Dex o Categoria.
   - Filtro per tutti i 18 Tipi con colori ufficiali.
   - Filtro per Rango (Starter, Rookie, Standard, Advanced, Expert, Master, Champion).
   - Filtri rapidi per Starter consigliati (`GoodStarter`) e Leggendari.
   - Ordinamento per N. Dex, Nome, HP o Statistiche Totali.
   - Selettore stile sprite in tempo reale:
     - **Book Art** (illustrazioni ufficiali del manuale)
     - **Home 3D** (render ad alta definizione)
     - **Box Pixel** (sprite pixel art)

2. **Scheda Pokémon Interattiva (Scheda Personaggio TRPG)**:
   - **Tracciatore a Punti (Dot Track)**: visualizzazione grafica dei 5 attributi di Pokérole (**Forza**, **Destrezza**, **Vitalità**, **Speciale**, **Intuito**) con punti base riempiti e anelli di capacità massima.
   - **Calcolatore Dinamico HP**: calcolo automatico dei Punti Vita in base al Rango (`Base HP + Vitalità × Moltiplicatore Rango`).
   - Albero delle evoluzioni con link cliccabili a tutte le forme collegate.
   - Learnset dettagliato suddiviso per Rango con tabelle di danno, precisione e bersaglio.

3. **Database Mosse (892 Mosse - Ottimizzato per Mobile)**:
   - Visualizzazione flessibile: selettore tra **🎴 Schede** e **📋 Tabella Compatta**.
   - Layout completamente responsive che si adatta a smartphone, tablet e desktop senza tagli o overflow.
   - Ricerca per nome, effetto o descrizione.
   - Filtro per Tipo, Categoria (Fisico, Speciale, Supporto) e Bersaglio.
   - Finestra dettagliata con lista di tutti i Pokémon che apprendono la mossa.

4. **Laboratorio Personaggi & Team (Pokérole 3.0)**:
   - **Creazione Allenatore**:
     - Attributi Principali (*Forza, Destrezza, Vitalità, Intuito*) e Sociali (*Tough, Beauty, Cool, Cute, Clever*) con tracciatori a punti.
     - Competenze / Abilità umane (*Rissa, Evasione, Allerta, Atletica, Medicina, Lore, Fascino...*).
     - Calcolo automatico di Punti Vita (`5 + Vitalità`), Punti Volontà (`Intuito + Fiducia Natura`), Iniziativa, Difesa e Difesa Speciale.
     - Gestione inventario e patrimonio.
     - Scheda visualizzabile completa e gestione della squadra Pokémon (fino a 6 elementi).
   - **Creazione Pokémon Personalizzati**:
     - Scelta della specie tra tutte le 1.200 presenti nel database con caricamento automatico di sprite, tipi e statistiche base/max.
     - Assegnazione attributi entro i limiti naturali della specie.
     - Selezione delle abilità naturali della specie o scelta da tutto il catalogo.
     - Inserimento di un massimo di 6 mosse da combattimento (dal Learnset naturale o da tutte le 892 mosse del manuale) con calcolo delle riserve di danno e tiri per colpire.
     - Assegnazione alla squadra di uno degli Allenatori creati o come Pokémon selvatico/libero.

5. **Catalogo Strumenti (236 Strumenti)**:
   - Suddiviso per Tasche (`HeldItems`, `TrainerItems`, `EvolutionItem`, `Medicine`, `Pokeballs`).
   - Supporto per prezzi da Allenatore e prezzi Pokémon Mystery Dungeon (PMD).
   - Visualizzazione icone sprite degli strumenti.

6. **Abilità & Nature**:
   - Effetti di gioco, descrizioni narrative e conteggio/lista Pokémon per ciascuna abilità.
   - Schede per le 25 nature con valori di Fiducia e spunti interpretativi per i giocatori.

7. **Lanciatore Dadi Integrato per Pokérole**:
   - Simulatore per riserve di Dadi D6 (Attributo + Abilità).
   - Gestione dei Dadi Rischio / Chance Dice (con rilevamento complicazioni sui risultati di 1).
   - Rilevamento automatico di Successi (4, 5, 6) e Colpi Critici (6).
   - Cronologia lanci della sessione.

---

## 🛠️ Tecnologie Utilizzate

- **Backend**: Python 3 con `Flask` e `sqlite3` (con bootstrap e auto-installazione trasparente).
- **Frontend**: HTML5 moderno, CSS3 responsivo (design a tema dark, glassmorphism e palette Pokérole), JavaScript vanilla (zero dipendenze npm o build step).
- **Database**: SQLite3 con indici per query sub-millisecondo.
