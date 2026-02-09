# /checkpoint

Beende deine Session sauber mit Commit und Handoff.

---

## Schritte

### 1. Aufräumen
Lösche temporäre Files falls vorhanden.

### 2. Projektmanagement aktualisieren
Falls eine Projektmanagement existiert (z.B. `features.json` in `.agents/`):
- Update `meta.last_updated` und `meta.last_agent`

Falls Dokumentation existiert (`agents.md`, `CHANGELOG.md`, etc.):
- Ergänze Session-Eintrag

> **Wichtig**: Fehlende Files NICHT automatisch erstellen.

### 3. Git Commit
Falls Änderungen vorhanden:
```bash
git add .
git commit -m "checkpoint: [Kurzbeschreibung]

- [Hauptänderung 1]
- [Hauptänderung 2]"
```

---

## Regeln

- Nutze `features.json` falls vorhanden, sonst `git log`/`git status`
- Update nur existierende Docs
- Commit nur bei Änderungen
- **State is Handoff**: Aktualisierte Projektmanagement-Dateien dienen als Handoff. Kein redundanter Text-Block nötig.
