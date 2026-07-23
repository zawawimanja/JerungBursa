const fs = require('fs');
const path = require('path');

const file1 = `C:\\Users\\aaror\\.gemini\\antigravity-ide\\brain\\4137cd64-ed99-464b-963f-6fffb3dcbac9\\.system_generated\\logs\\transcript.jsonl`;
const file2 = `C:\\Users\\aaror\\.gemini\\antigravity-ide\\brain\\c2493d33-ad31-4651-9574-cf7ff6b597a9\\.system_generated\\logs\\transcript.jsonl`;

function searchInFile(filePath) {
    console.log('=== Searching in', path.basename(filePath), '===');
    if (!fs.existsSync(filePath)) {
        console.log('File does not exist');
        return;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
        if (!line) return;
        try {
            const data = JSON.parse(line);
            const text = JSON.stringify(data.content || '') + JSON.stringify(data.tool_calls || '');
            if (text.toLowerCase().includes('stratus') || text.toLowerCase().includes('mmcs') || text.toLowerCase().includes('srkk') || text.toLowerCase().includes('ei power') || text.toLowerCase().includes('eipower')) {
                console.log(`Line ${idx + 1} (${data.type}):`);
                // Print user inputs or model responses that are relevant
                if (data.type === 'USER_INPUT') {
                    console.log('  USER:', data.content);
                } else if (data.type === 'PLANNER_RESPONSE') {
                    console.log('  MODEL:', data.content);
                } else {
                    console.log('  OTHER:', data.type, text.substring(0, 200) + '...');
                }
            }
        } catch (e) {
            // ignore JSON parse error
        }
    });
}

searchInFile(file1);
searchInFile(file2);
