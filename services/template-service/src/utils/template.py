from typing import List, Dict
import re


def render_template(template_text: str, variables: Dict[str, str]) -> str:
    """Render template by replacing variables like {{name}}"""

    def replace_var(match):
        var_name = match.group(1).strip()
        return str(variables.get(var_name, f"{{{{{var_name}}}}}"))

    pattern = r"\{\{([^}]+)\}\}"
    rendered = re.sub(pattern, replace_var, template_text)
    return rendered


def extract_variables(template_text: str) -> List[str]:
    """Extract all variables from template text"""
    pattern = r"\{\{([^}]+)\}\}"
    matches = re.findall(pattern, template_text)
    return [var.strip() for var in matches]
