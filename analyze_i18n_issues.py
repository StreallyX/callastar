#!/usr/bin/env python3
"""
Script pour analyser les problèmes i18n dans le projet Callastar
"""
import os
import re
from pathlib import Path
from collections import defaultdict

# Dossier racine du projet
PROJECT_ROOT = Path("/home/ubuntu/github_repos/callastar")
APP_DIR = PROJECT_ROOT / "app" / "[locale]"

# Patterns à rechercher
PATTERNS = {
    "getTranslations_without_locale": r'getTranslations\([\'"][\w.]+[\'"]\)',
    "getTranslations_empty": r'getTranslations\(\)',
    "format_date_without_locale": r'\.toLocaleDateString\(\)',
    "format_date_with_hardcoded": r'\.toLocaleDateString\([\'"]fr[\'"]',
    "link_without_locale": r'href=["\'](?!/api|http|#)[^"\']*["\']',
    "useLocale_import": r'from [\'"]next-intl[\'"]',
    "server_component_params": r'params:\s*\{[^}]*locale[^}]*\}',
}

# Résultats
issues = defaultdict(list)

def analyze_file(file_path):
    """Analyse un fichier pour détecter les problèmes i18n"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        relative_path = file_path.relative_to(PROJECT_ROOT)
        
        # Ignorer les fichiers admin
        if '/admin/' in str(relative_path):
            return
        
        # Vérifier si c'est un Server Component (pas de 'use client')
        lines = content.split('\n')
        is_server_component = 'use client' not in '\n'.join(lines[0:10])
        
        # Vérifier getTranslations sans locale appropriée
        if 'getTranslations(' in content:
            # Chercher les appels getTranslations
            matches = re.finditer(r'getTranslations\(([^)]*)\)', content)
            for match in matches:
                args = match.group(1).strip()
                line_num = content[:match.start()].count('\n') + 1
                
                # Si pas d'arguments ou seulement un namespace string
                if not args or (args.startswith('"') or args.startswith("'")):
                    issues['getTranslations_missing_locale'].append({
                        'file': str(relative_path),
                        'line': line_num,
                        'code': match.group(0)
                    })
                # Si pas de locale dans les arguments
                elif 'locale' not in args:
                    issues['getTranslations_missing_locale'].append({
                        'file': str(relative_path),
                        'line': line_num,
                        'code': match.group(0)
                    })
        
        # Vérifier les formatages de dates
        date_formats = re.finditer(r'\.toLocaleDateString\(([^)]*)\)', content)
        for match in date_formats:
            args = match.group(1).strip()
            line_num = content[:match.start()].count('\n') + 1
            
            # Si vide ou hardcodé à 'fr'
            if not args or args.startswith('"fr"') or args.startswith("'fr'"):
                issues['date_format_hardcoded'].append({
                    'file': str(relative_path),
                    'line': line_num,
                    'code': match.group(0)
                })
        
        # Vérifier les params dans les Server Components
        if is_server_component and 'export default' in content:
            # Chercher la signature de la fonction
            func_match = re.search(r'export default (?:async )?function[^(]*\(([^)]*)\)', content)
            if func_match:
                params = func_match.group(1)
                if 'params' not in params:
                    issues['server_component_missing_params'].append({
                        'file': str(relative_path),
                        'line': content[:func_match.start()].count('\n') + 1,
                        'note': 'Server Component sans params'
                    })
                elif 'locale' not in params:
                    # Vérifier si locale est destructuré des params
                    if not re.search(r'const\s+\{\s*locale\s*\}\s*=\s*params', content):
                        issues['server_component_locale_not_extracted'].append({
                            'file': str(relative_path),
                            'line': content[:func_match.start()].count('\n') + 1,
                            'note': 'locale non extrait de params'
                        })
        
        # Vérifier l'utilisation de Link natif au lieu de next-intl Link
        if '<Link' in content or 'from "next/link"' in content or "from 'next/link'" in content:
            if 'from "next/link"' in content or "from 'next/link'" in content:
                issues['native_link_import'].append({
                    'file': str(relative_path),
                    'note': 'Utilise Link de next/link au lieu de next-intl'
                })
        
    except Exception as e:
        print(f"Erreur lors de l'analyse de {file_path}: {e}")

def main():
    """Fonction principale"""
    print("🔍 Analyse des problèmes i18n dans le projet Callastar...")
    print(f"📂 Dossier analysé : {APP_DIR}")
    print()
    
    # Parcourir tous les fichiers .tsx et .ts
    for file_path in APP_DIR.rglob("*.tsx"):
        if file_path.is_file():
            analyze_file(file_path)
    
    for file_path in APP_DIR.rglob("*.ts"):
        if file_path.is_file() and not file_path.name.endswith('.d.ts'):
            analyze_file(file_path)
    
    # Afficher les résultats
    print("\n" + "="*80)
    print("📊 RAPPORT D'ANALYSE DES PROBLÈMES I18N")
    print("="*80 + "\n")
    
    total_issues = sum(len(v) for v in issues.values())
    
    if total_issues == 0:
        print("✅ Aucun problème détecté!")
    else:
        print(f"⚠️  {total_issues} problèmes détectés\n")
        
        # getTranslations sans locale
        if 'getTranslations_missing_locale' in issues:
            print(f"\n🔴 getTranslations sans locale appropriée ({len(issues['getTranslations_missing_locale'])} occurrences):")
            print("-" * 80)
            for issue in issues['getTranslations_missing_locale']:
                print(f"  📄 {issue['file']}:{issue['line']}")
                print(f"     Code: {issue['code']}")
        
        # Formatage de dates hardcodé
        if 'date_format_hardcoded' in issues:
            print(f"\n🔴 Formatage de dates hardcodé ou vide ({len(issues['date_format_hardcoded'])} occurrences):")
            print("-" * 80)
            for issue in issues['date_format_hardcoded']:
                print(f"  📄 {issue['file']}:{issue['line']}")
                print(f"     Code: {issue['code']}")
        
        # Server Components sans params
        if 'server_component_missing_params' in issues:
            print(f"\n🔴 Server Components sans params ({len(issues['server_component_missing_params'])} occurrences):")
            print("-" * 80)
            for issue in issues['server_component_missing_params']:
                print(f"  📄 {issue['file']}:{issue['line']}")
                print(f"     Note: {issue['note']}")
        
        # Locale non extrait
        if 'server_component_locale_not_extracted' in issues:
            print(f"\n🟡 Server Components avec locale non extrait ({len(issues['server_component_locale_not_extracted'])} occurrences):")
            print("-" * 80)
            for issue in issues['server_component_locale_not_extracted']:
                print(f"  📄 {issue['file']}:{issue['line']}")
                print(f"     Note: {issue['note']}")
        
        # Link natif
        if 'native_link_import' in issues:
            print(f"\n🟡 Utilisation de Link natif ({len(issues['native_link_import'])} occurrences):")
            print("-" * 80)
            for issue in issues['native_link_import']:
                print(f"  📄 {issue['file']}")
                print(f"     Note: {issue['note']}")
    
    print("\n" + "="*80)
    print("✅ Analyse terminée!")
    print("="*80)

if __name__ == "__main__":
    main()
