#!/usr/bin/env python3
"""
Script de vérification de la synchronisation entre fr.json et en.json
"""

import json
from typing import Set, List, Tuple

def get_all_key_paths(data, parent_path="") -> Set[str]:
    """Récupère tous les chemins de clés d'un objet JSON"""
    paths = set()
    
    if isinstance(data, dict):
        for key, value in data.items():
            current_path = f"{parent_path}.{key}" if parent_path else key
            paths.add(current_path)
            if isinstance(value, (dict, list)):
                paths.update(get_all_key_paths(value, current_path))
    elif isinstance(data, list):
        for i, item in enumerate(data):
            current_path = f"{parent_path}[{i}]"
            if isinstance(item, (dict, list)):
                paths.update(get_all_key_paths(item, current_path))
    
    return paths

def compare_structures(fr_data, en_data) -> Tuple[Set[str], Set[str], Set[str]]:
    """Compare les structures et retourne les clés communes, manquantes et en trop"""
    fr_keys = get_all_key_paths(fr_data)
    en_keys = get_all_key_paths(en_data)
    
    common = fr_keys & en_keys
    missing_in_en = fr_keys - en_keys
    extra_in_en = en_keys - fr_keys
    
    return common, missing_in_en, extra_in_en

def verify_values(fr_data, en_data, path="") -> List[str]:
    """Vérifie que les valeurs sont bien traduites (pas identiques)"""
    issues = []
    
    if isinstance(fr_data, dict) and isinstance(en_data, dict):
        for key in fr_data.keys():
            if key in en_data:
                current_path = f"{path}.{key}" if path else key
                issues.extend(verify_values(fr_data[key], en_data[key], current_path))
    elif isinstance(fr_data, str) and isinstance(en_data, str):
        # Vérifier si la valeur n'est pas traduite (identique)
        if fr_data == en_data and len(fr_data) > 3:
            # Ignorer les valeurs courtes qui peuvent être identiques
            # et les valeurs qui sont des noms propres ou codes
            if not any(x in fr_data for x in ["Call a Star", "Dashboard", "Email", "EUR", "USD"]):
                issues.append(f"{path}: '{fr_data}' non traduit")
    
    return issues

def main():
    print("🔍 Vérification de la synchronisation fr.json ↔ en.json")
    print("=" * 70)
    
    # Lire les fichiers
    print("\n📖 Lecture des fichiers...")
    with open("messages/fr.json", 'r', encoding='utf-8') as f:
        fr_data = json.load(f)
    
    with open("messages/en.json", 'r', encoding='utf-8') as f:
        en_data = json.load(f)
    
    print("✓ Fichiers chargés")
    
    # Comparer les structures
    print("\n🔄 Comparaison des structures...")
    common, missing, extra = compare_structures(fr_data, en_data)
    
    print(f"\n📊 Résultats de la comparaison :")
    print(f"   • Clés communes           : {len(common)}")
    print(f"   • Clés manquantes en en.json : {len(missing)}")
    print(f"   • Clés en trop dans en.json  : {len(extra)}")
    
    # Afficher les clés manquantes
    if missing:
        print(f"\n❌ Clés manquantes dans en.json ({len(missing)}) :")
        for key in sorted(list(missing)[:20]):
            print(f"   - {key}")
        if len(missing) > 20:
            print(f"   ... et {len(missing) - 20} autres")
    
    # Afficher les clés en trop
    if extra:
        print(f"\n⚠️  Clés en trop dans en.json ({len(extra)}) :")
        for key in sorted(list(extra)[:20]):
            print(f"   - {key}")
        if len(extra) > 20:
            print(f"   ... et {len(extra) - 20} autres")
    
    # Vérifier quelques traductions
    print("\n🔎 Vérification de la qualité des traductions...")
    issues = verify_values(fr_data, en_data)
    
    if issues:
        print(f"\n⚠️  Valeurs potentiellement non traduites ({len(issues)}) :")
        for issue in issues[:10]:
            print(f"   - {issue}")
        if len(issues) > 10:
            print(f"   ... et {len(issues) - 10} autres")
    else:
        print("✓ Aucun problème de traduction détecté")
    
    # Rapport final
    print("\n" + "=" * 70)
    if not missing and not extra:
        print("✅ SYNCHRONISATION PARFAITE !")
        print("   • Toutes les clés sont synchronisées")
        print("   • La structure est identique")
        print("   • fr.json et en.json sont parfaitement alignés")
    else:
        print("⚠️  SYNCHRONISATION INCOMPLÈTE")
        print(f"   • {len(missing)} clés manquantes")
        print(f"   • {len(extra)} clés en trop")
    
    print("=" * 70)
    
    # Générer un rapport JSON
    report = {
        "status": "synchronized" if not missing and not extra else "issues_detected",
        "fr_keys_count": len(get_all_key_paths(fr_data)),
        "en_keys_count": len(get_all_key_paths(en_data)),
        "common_keys": len(common),
        "missing_in_en": list(missing),
        "extra_in_en": list(extra),
        "translation_issues": issues
    }
    
    with open("i18n_sync_report.json", 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    print("\n📄 Rapport détaillé sauvegardé dans : i18n_sync_report.json")

if __name__ == "__main__":
    main()
