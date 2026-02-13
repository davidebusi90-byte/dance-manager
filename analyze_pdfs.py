import os
import re
import json
from pathlib import Path

try:
    import PyPDF2
except ImportError:
    print("PyPDF2 not installed. Installing...")
    os.system("pip install PyPDF2")
    import PyPDF2

def extract_text_from_pdf(pdf_path):
    """Extract text from a PDF file."""
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
            return text
    except Exception as e:
        return f"Error reading {pdf_path}: {str(e)}"

def analyze_competition_pdf(pdf_path):
    """Analyze a single competition PDF and extract key information."""
    text = extract_text_from_pdf(pdf_path)
    
    # Extract competition name from filename
    filename = Path(pdf_path).stem
    
    analysis = {
        "filename": filename,
        "full_text": text[:5000],  # First 5000 chars for preview
        "text_length": len(text),
        "events": [],
        "categories": set(),
        "disciplines": set(),
        "classes": set()
    }
    
    # Common patterns to look for
    category_patterns = [
        r'Debuttanti', r'Principianti', r'Class\s*[A-D]', r'Juvenile', 
        r'Junior', r'Youth', r'Adult', r'Senior', r'Over\s*\d+',
        r'Seniores', r'Giovanissimi', r'Ragazzi', r'Allievi'
    ]
    
    discipline_patterns = [
        r'Latino?\s*Americane?', r'Standard', r'Combinata',
        r'Latin', r'Ballroom', r'10\s*Dance', r'Liscio'
    ]
    
    # Search for patterns
    for pattern in category_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        analysis["categories"].update(matches)
    
    for pattern in discipline_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        analysis["disciplines"].update(matches)
    
    # Convert sets to lists for JSON serialization
    analysis["categories"] = sorted(list(analysis["categories"]))
    analysis["disciplines"] = sorted(list(analysis["disciplines"]))
    analysis["classes"] = sorted(list(analysis["classes"]))
    
    return analysis

def main():
    pdf_dir = r"c:\Users\david\Downloads\Antigravity\Dance Manager\iscrizioni in pdf"
    output_file = r"c:\Users\david\Downloads\Antigravity\Dance Manager\pdf_analysis_results.json"
    
    results = []
    
    # Get all PDF files
    pdf_files = [f for f in os.listdir(pdf_dir) if f.endswith('.pdf')]
    
    print(f"Found {len(pdf_files)} PDF files")
    print("=" * 80)
    
    for pdf_file in sorted(pdf_files):
        pdf_path = os.path.join(pdf_dir, pdf_file)
        print(f"\nAnalyzing: {pdf_file}")
        
        analysis = analyze_competition_pdf(pdf_path)
        results.append(analysis)
        
        print(f"  - Text length: {analysis['text_length']} characters")
        print(f"  - Categories found: {', '.join(analysis['categories']) if analysis['categories'] else 'None'}")
        print(f"  - Disciplines found: {', '.join(analysis['disciplines']) if analysis['disciplines'] else 'None'}")
    
    # Save results
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print("\n" + "=" * 80)
    print(f"\nAnalysis complete! Results saved to: {output_file}")
    
    # Summary statistics
    all_categories = set()
    all_disciplines = set()
    
    for result in results:
        all_categories.update(result['categories'])
        all_disciplines.update(result['disciplines'])
    
    print(f"\n=== SUMMARY ===")
    print(f"Total PDFs analyzed: {len(results)}")
    print(f"\nAll categories found: {', '.join(sorted(all_categories))}")
    print(f"\nAll disciplines found: {', '.join(sorted(all_disciplines))}")

if __name__ == "__main__":
    main()
