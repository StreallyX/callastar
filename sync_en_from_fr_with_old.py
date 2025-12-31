#!/usr/bin/env python3
"""
Script pour créer en.json en utilisant la structure de fr.json
et en préservant les traductions existantes de en_old.json
"""

import json
from deep_translator import GoogleTranslator
import time
import re

def protect_placeholders(text):
    """Protège les placeholders {variable} pendant la traduction"""
    if not isinstance(text, str):
        return text, {}
    
    placeholders = re.findall(r'\{[^\}]+\}', text)
    protected = text
    placeholder_map = {}
    
    for i, ph in enumerate(placeholders):
        marker = f"PLACEHOLDER{i}"
        placeholder_map[marker] = ph
        protected = protected.replace(ph, marker)
    
    return protected, placeholder_map

def restore_placeholders(text, placeholder_map):
    """Restaure les placeholders d'origine"""
    restored = text
    for marker, ph in placeholder_map.items():
        restored = restored.replace(marker, ph)
    return restored

def translate_text(text, translator, retry=3):
    """Traduit un texte avec gestion des placeholders"""
    if not isinstance(text, str) or not text.strip():
        return text
    
    protected, ph_map = protect_placeholders(text)
    
    for attempt in range(retry):
        try:
            translated = translator.translate(protected)
            result = restore_placeholders(translated, ph_map)
            return result
        except Exception as e:
            if attempt < retry - 1:
                time.sleep(0.5)
            else:
                print(f"    ❌ Échec: {text[:40]}...")
                return text
    
    return text

def get_nested_value(data, keys):
    """Récupère une valeur dans un objet JSON imbriqué"""
    current = data
    for key in keys:
        if isinstance(current, dict) and key in current:
            current = current[key]
        else:
            return None
    return current

def sync_structure(fr_data, en_old_data, translator, path_keys=[], stats=None):
    """
    Synchronise récursivement la structure en utilisant:
    - La structure de fr.json comme référence
    - Les valeurs de en_old.json quand elles existent
    - La traduction pour les valeurs manquantes
    """
    if stats is None:
        stats = {"translated": 0, "reused": 0, "total": 0}
    
    if isinstance(fr_data, dict):
        result = {}
        for key, fr_value in fr_data.items():
            # Chercher la valeur correspondante dans en_old
            en_old_value = get_nested_value(en_old_data, [key]) if isinstance(en_old_data, dict) else None
            
            # Traiter récursivement
            result[key] = sync_structure(fr_value, en_old_value, translator, path_keys + [key], stats)
        return result
    
    elif isinstance(fr_data, list):
        result = []
        for i, fr_item in enumerate(fr_data):
            en_old_item = en_old_data[i] if isinstance(en_old_data, list) and i < len(en_old_data) else None
            result.append(sync_structure(fr_item, en_old_item, translator, path_keys + [f"[{i}]"], stats))
        return result
    
    elif isinstance(fr_data, str):
        stats["total"] += 1
        
        # Si on a déjà une traduction dans en_old, l'utiliser
        if isinstance(en_old_data, str) and en_old_data.strip():
            stats["reused"] += 1
            return en_old_data
        
        # Sinon, traduire
        path_str = ".".join(str(k) for k in path_keys)
        if stats["translated"] % 10 == 0 and stats["translated"] > 0:
            print(f"    [{stats['translated']}/{stats['total']}] Traduction en cours...")
        
        translated = translate_text(fr_data, translator)
        stats["translated"] += 1
        time.sleep(0.3)  # Éviter de saturer l'API
        return translated
    
    else:
        # Nombres, booléens, null
        return fr_data

def main():
    print("🚀 Synchronisation de en.json avec fr.json + traductions existantes")
    print("=" * 70)
    
    # Lire les fichiers
    print("\n📖 Lecture des fichiers...")
    with open("messages/fr.json", 'r', encoding='utf-8') as f:
        fr_data = json.load(f)
    
    with open("messages/en_old.json", 'r', encoding='utf-8') as f:
        en_old_data = json.load(f)
    
    print("✓ Fichiers chargés")
    
    # Initialiser le traducteur
    print("\n🌐 Initialisation du traducteur...")
    translator = GoogleTranslator(source='fr', target='en')
    print("✓ Traducteur prêt")
    
    # Synchroniser la structure
    print("\n🔄 Synchronisation de la structure...")
    print("   • Réutilisation des traductions existantes")
    print("   • Traduction des valeurs manquantes")
    
    stats = {"translated": 0, "reused": 0, "total": 0}
    en_new_data = sync_structure(fr_data, en_old_data, translator, stats=stats)
    
    print(f"\n✓ Synchronisation terminée")
    print(f"   • Traductions réutilisées : {stats['reused']}")
    print(f"   • Nouvelles traductions   : {stats['translated']}")
    print(f"   • Total                   : {stats['total']}")
    
    # Écrire le nouveau fichier
    print("\n💾 Écriture de messages/en.json...")
    with open("messages/en.json", 'w', encoding='utf-8') as f:
        json.dump(en_new_data, f, ensure_ascii=False, indent=2)
    
    print("✓ Fichier créé")
    
    # Vérification
    def count_keys(data):
        if isinstance(data, dict):
            return sum(1 if not isinstance(v, (dict, list)) else count_keys(v) for v in data.values())
        elif isinstance(data, list):
            return sum(count_keys(item) for item in data)
        return 1
    
    fr_count = count_keys(fr_data)
    en_count = count_keys(en_new_data)
    
    print("\n" + "=" * 70)
    print("✅ Création de en.json terminée avec succès !")
    print(f"   • Valeurs dans fr.json : {fr_count}")
    print(f"   • Valeurs dans en.json : {en_count}")
    print(f"   • Synchronisation      : {'✓ Parfaite' if fr_count == en_count else '✗ Écart'}")
    print("=" * 70)

if __name__ == "__main__":
    main()
