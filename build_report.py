import os
import glob

brain_dir = r"C:\Users\Sujal Patel\.gemini\antigravity\brain\27222d09-4638-4a2e-bfd3-decd42f0cc42"

part1_path = os.path.join(brain_dir, "internship_report_part1.md")
part2_path = os.path.join(brain_dir, "internship_report_part2.md")
diagrams_path = os.path.join(brain_dir, "report_diagrams_and_charts.md")
output_md = r"C:\Users\Sujal Patel\Desktop\sujal-poss\5ive_POS_Internship_Report.md"

synthetic_data_section = """
### 3.4.3 Privacy-Preserving Synthetic Data Simulation

A critical challenge when developing Big Data Analytics systems for enterprise domains is acquiring statistically realistic historical data without violating data privacy laws (such as the DPDP Act) or corporate confidentiality. Real restaurant POS data contains highly sensitive business intelligence, including exact profit margins, ingredient supply costs, daily revenue figures, and customer Personally Identifiable Information (PII).

To scientifically validate the ML Sales Forecasting and the Revenue Intelligence Engine (which require 90 to 180 days of historical data to function), a **Privacy-Preserving Synthetic Data Simulator** was engineered. This simulator algorithmically generates transactional data that adheres to real-world statistical distributions rather than random noise:

* **Poisson Distribution:** Used to simulate order arrival times, accurately creating realistic traffic clusters during lunch (12:00–14:00) and dinner (19:00–22:00) peak hours.
* **Pareto Principle (80/20 Rule):** Applied to menu item popularity, ensuring that approximately 20% of the menu generates 80% of the sales volume (accurately simulating 'Star' and 'Workhorse' items for the BCG matrix).
* **Realistic Cost Margins:** The data generator calculates food costs using the Bill of Materials (BOM) to ensure Contribution Margins strictly remain within the realistic Indian restaurant economic boundaries of 40–60%.

The entire Big Data pipeline — from the FastAPI backend through the SQLAlchemy ORM to the CrewAI agents — is fundamentally **data-agnostic**. The algorithms process the synthetic data exactly identically to how they would process real production data. This approach demonstrates enterprise-grade system validation while strictly adhering to data privacy and security principles.

---

"""

try:
    with open(part1_path, "r", encoding="utf-8") as f:
        part1 = f.read()
    
    with open(part2_path, "r", encoding="utf-8") as f:
        part2 = f.read()

    with open(diagrams_path, "r", encoding="utf-8") as f:
        diagrams = f.read()

    # Find where to insert the new section (end of section 3.4.2)
    insert_marker = "## 3.5 Tools and Development Environment"
    if insert_marker in part1:
        part1 = part1.replace(insert_marker, synthetic_data_section + insert_marker)
    else:
        part1 += "\n" + synthetic_data_section

    combined_content = part1 + "\n\n" + part2 + "\n\n" + diagrams

    with open(output_md, "w", encoding="utf-8") as f:
        f.write(combined_content)
    
    print("Combined markdown created successfully at:", output_md)
except Exception as e:
    print("Error:", str(e))
