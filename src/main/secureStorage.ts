import { safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'

export interface SecureStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/**
 * Speichert Schlüssel-Wert-Paare verschlüsselt in einer Datei. Die
 * Verschlüsselung übernimmt Electron `safeStorage` (unter Windows DPAPI).
 * Ist keine Verschlüsselung verfügbar, bleiben die Werte nur im
 * Arbeitsspeicher, damit nie ein Token im Klartext auf der Festplatte landet.
 */
export function createEncryptedStorage(filePath: string): SecureStorage {
  const canPersist = safeStorage.isEncryptionAvailable()
  let cache: Record<string, string> | null = null

  function load(): Record<string, string> {
    if (cache) return cache
    cache = {}
    if (canPersist && existsSync(filePath)) {
      try {
        cache = JSON.parse(safeStorage.decryptString(readFileSync(filePath)))
      } catch {
        // Datei beschädigt oder von einem anderen Windows-Benutzer: neu anfangen.
        cache = {}
      }
    }
    return cache as Record<string, string>
  }

  function save(): void {
    if (!canPersist || !cache) return
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, safeStorage.encryptString(JSON.stringify(cache)))
  }

  return {
    getItem: (key) => load()[key] ?? null,
    setItem: (key, value) => {
      load()[key] = value
      save()
    },
    removeItem: (key) => {
      delete load()[key]
      save()
    }
  }
}
