#!/usr/bin/env python3
import os
import re
import json
from pathlib import Path

# Patterns to detect hardcoded text
HARDCODED_TEXT_PATTERNS = [
    r'<h[1-6][^>]*>([A-Za-zÀ-ÿ\s]+)</h[1-6]>',  # Headings with text
    r'<p[^>]*>([A-Za-zÀ-ÿ\s,\.!?]+)</p>',  # Paragraphs
    r'<button[^>]*>([A-Za-zÀ-ÿ\s]+)</button>',  # Buttons
    r'<span[^>]*>([A-Za-zÀ-ÿ\s]+)</span>',  # Spans
    r'<label[^>]*>([A-Za-zÀ-ÿ\s]+)</label>',  # Labels
    r'placeholder="([^"]+)"',  # Placeholders
    r'title="([^"]+)"',  # Titles
    r'alt="([^"]+)"',  # Alt text
]

# Function to check if file uses translations
def uses_translations(content):
    return 'useTranslations' in content or 'getTranslations' in content

# Function to find hardcoded text
def find_hardcoded_text(content, file_path):
    hardcoded = []
    lines = content.split('\n')
    
    for i, line in enumerate(lines, 1):
        # Skip comments and imports
        if line.strip().startswith('//') or line.strip().startswith('import'):
            continue
        
        # Look for hardcoded strings
        for pattern in HARDCODED_TEXT_PATTERNS:
            matches = re.finditer(pattern, line)
            for match in matches:
                text = match.group(1) if match.lastindex >= 1 else match.group(0)
                # Filter out common non-translatable items
                if len(text.strip()) > 2 and not text.isdigit():
                    hardcoded.append({
                        'line': i,
                        'text': text.strip(),
                        'context': line.strip()[:100]
                    })
    
    return hardcoded

# Main analysis
def analyze_codebase():
    base_path = Path('app/[locale]')
    results = {
        'needs_translation': [],
        'has_translation': [],
        'summary': {
            'total_files': 0,
            'needs_translation': 0,
            'has_translation': 0
        }
    }
    
    for file_path in base_path.rglob('*.tsx'):
        if file_path.is_file():
            results['summary']['total_files'] += 1
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                has_translations = uses_translations(content)
                hardcoded = find_hardcoded_text(content, str(file_path))
                
                file_info = {
                    'path': str(file_path),
                    'uses_translations': has_translations,
                    'hardcoded_texts': len(hardcoded),
                    'samples': hardcoded[:5] if hardcoded else []
                }
                
                if not has_translations or hardcoded:
                    results['needs_translation'].append(file_info)
                    results['summary']['needs_translation'] += 1
                else:
                    results['has_translation'].append(file_info)
                    results['summary']['has_translation'] += 1
                    
            except Exception as e:
                print(f"Error reading {file_path}: {e}")
    
    return results

# Run analysis
results = analyze_codebase()

# Print report
print("\n" + "="*80)
print("COMPREHENSIVE CODE ANALYSIS REPORT")
print("="*80)

print(f"\n📊 SUMMARY:")
print(f"  Total files scanned: {results['summary']['total_files']}")
print(f"  ✅ Files with translations: {results['summary']['has_translation']}")
print(f"  ⚠️  Files needing translation: {results['summary']['needs_translation']}")

print(f"\n⚠️  FILES NEEDING TRANSLATION ({len(results['needs_translation'])}):")
print("-"*80)

for file_info in results['needs_translation']:
    print(f"\n📄 {file_info['path']}")
    print(f"   Uses translations: {'✅' if file_info['uses_translations'] else '❌'}")
    print(f"   Hardcoded texts found: {file_info['hardcoded_texts']}")
    if file_info['samples']:
        print(f"   Sample hardcoded text:")
        for sample in file_info['samples'][:3]:
            print(f"     Line {sample['line']}: '{sample['text']}'")

print(f"\n✅ FILES WITH COMPLETE TRANSLATIONS ({len(results['has_translation'])}):")
print("-"*80)
for file_info in results['has_translation']:
    print(f"  ✓ {file_info['path']}")

# Save detailed report
with open('translation_analysis.json', 'w') as f:
    json.dump(results, f, indent=2)

print(f"\n📁 Detailed report saved to: translation_analysis.json")
print("="*80)
