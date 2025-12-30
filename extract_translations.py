#!/usr/bin/env python3
import re
import json

# Function to extract French text from file
def extract_french_text(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Common patterns for hardcoded text
    patterns = [
        r"'([^']{3,})'",  # Single quotes
        r'"([^"]{3,})"',  # Double quotes
    ]
    
    matches = set()
    for pattern in patterns:
        for match in re.finditer(pattern, content):
            text = match.group(1)
            # Filter for actual French text (contains spaces or French characters)
            if (' ' in text or any(c in text for c in 'àâäéèêëïîôùûüÿæœç')) and len(text) > 3:
                # Exclude imports, technical strings, etc.
                if not text.startswith(('/', '@', 'use', 'import', 'const', 'let', 'var', 'function')):
                    matches.add(text)
    
    return sorted(list(matches))

# Files to analyze
files_to_check = [
    'app/[locale]/dashboard/creator/payments/page.tsx',
    'app/[locale]/dashboard/creator/reviews/page.tsx',
    'app/[locale]/dashboard/creator/calls/page.tsx',
    'app/[locale]/dashboard/creator/earnings/page.tsx',
    'app/[locale]/dashboard/creator/fees/page.tsx',
]

print("=== EXTRACTED FRENCH TEXT ===\n")
for file_path in files_to_check:
    print(f"\n📄 {file_path}:")
    print("-" * 80)
    try:
        texts = extract_french_text(file_path)
        for i, text in enumerate(texts[:15], 1):  # Show first 15
            print(f"  {i}. {text}")
        if len(texts) > 15:
            print(f"  ... and {len(texts) - 15} more")
    except Exception as e:
        print(f"  Error: {e}")

