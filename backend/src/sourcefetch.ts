export async function fetchVerifiedSource(
  address: string,
  explorerBaseUrl: string
): Promise<{ verified: boolean; sourceCode?: string; contractName?: string }> {
  try {
    const url = `${explorerBaseUrl}/api?module=contract&action=getsourcecode&address=${address}`;
    const response = await fetch(url);
    if (!response.ok) return { verified: false };

    const data = await response.json();
    const result = data?.result;
    if (!Array.isArray(result) || result.length === 0) return { verified: false };

    const sourceCode: string = result[0].SourceCode;
    if (!sourceCode) return { verified: false };

    let finalSource = sourceCode;

    if (sourceCode.startsWith("{{")) {
      // Blockscout multi-file JSON wrapper: strip one layer of braces then parse
      const inner = sourceCode.slice(1, -1);
      const parsed = JSON.parse(inner) as {
        sources: Record<string, { content: string }>;
      };
      finalSource = Object.entries(parsed.sources)
        .map(([filename, file]) => `// FILE: ${filename}\n${file.content}`)
        .join("\n\n");
    }

    return {
      verified: true,
      sourceCode: finalSource,
      contractName: result[0].ContractName,
    };
  } catch {
    return { verified: false };
  }
}
