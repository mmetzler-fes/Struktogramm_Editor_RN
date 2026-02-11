// Generator: Tree -> Mermaid

let idCounter = 0;
const getId = () => `node_${idCounter++}`;

const escape = (label) => label.replace(/["\n]/g, '');

const generateNodeCode = (node) => {
	const id = getId();
	let code = '';
	let type = node.type;
	let label = node.label || type;

	// Mermaid Node definition
	let nodeDef = '';
	if (type === 'decision') {
		nodeDef = `${id}{"${escape(label)}"}`;
	} else if (['for_loop', 'while_loop', 'repeat_loop'].includes(type) || type === 'loop') {
		// Use stadium shape for loops
		nodeDef = `${id}(["${escape(label)}"])`;
	} else if (type === 'terminal' || type === 'exit') {
		nodeDef = `${id}(["${escape(label)}"])`;
	} else {
		nodeDef = `${id}["${escape(label)}"]`;
	}

	code += `${nodeDef}\n`;

	return { id, code };
};

export const generateMermaid = (tree) => {
	idCounter = 0;

	const { startId, code } = processBlockList(tree.children);

	return `graph TD\n${code}`;
};

const processBlockList = (blocks) => {
	if (!blocks || blocks.length === 0) return { startId: null, endId: null, code: '' };

	let fullCode = '';
	let firstId = null;
	let lastId = null;

	for (let i = 0; i < blocks.length; i++) {
		const block = blocks[i];
		const res = processBlock(block);

		fullCode += res.code;

		if (i === 0) firstId = res.startId;

		if (lastId) {
			// Connect previous to current
			fullCode += `${lastId} --> ${res.startId}\n`;
		}

		lastId = res.endId;
	}

	return { startId: firstId, endId: lastId, code: fullCode };
};

const processBlock = (block) => {
	const { id, code } = generateNodeCode(block);
	let fullCode = code;
	let endId = id;

	if (block.type === 'decision') {
		// Decision logic
		// Decision -> Yes -> Merge
		// Decision -> No -> Merge
		// We need a Merge node to bring them back together?
		// In structured programming, yes.
		// But Mermaid flowchart doesn't enforce standard merge.
		// However, if we don't merge, where does the "next" block connect?
		// It connects to the end of both branches.
		// So we create a Merge node (invisible or dummy).
		const mergeId = getId();
		fullCode += `${mergeId}{{" "}}\n`; // Hexagon or similar for merge point/continuation, or just empty
		// Actually, let's use a small circle or point? 
		// Or just `call` join.
		// Let's use a coordinate node or just a simple join node.

		// Yes Branch
		const yesRes = processBlockList(block.yes);
		if (yesRes.startId) {
			fullCode += `${id} -->|Ja| ${yesRes.startId}\n`;
			fullCode += yesRes.code;
			fullCode += `${yesRes.endId} --> ${mergeId}\n`;
		} else {
			fullCode += `${id} -->|Ja| ${mergeId}\n`;
		}

		// No Branch
		const noRes = processBlockList(block.no);
		if (noRes.startId) {
			fullCode += `${id} -->|Nein| ${noRes.startId}\n`;
			fullCode += noRes.code;
			fullCode += `${noRes.endId} --> ${mergeId}\n`;
		} else {
			fullCode += `${id} -->|Nein| ${mergeId}\n`;
		}

		endId = mergeId;

	} else if (['for_loop', 'while_loop', 'repeat_loop', 'loop'].includes(block.type)) {
		// Loop logic
		// Head -> Body -> Head
		// Head -> Exit (Merge)

		// Actually, for NSD, the flow enters Head, goes to Body, comes back to Head.
		// And if Condition False, goes to Next.

		const bodyRes = processBlockList(block.children);

		if (bodyRes.startId) {
			fullCode += `${id} --> ${bodyRes.startId}\n`;
			fullCode += bodyRes.code;
			fullCode += `${bodyRes.endId} --> ${id}\n`;
		} else {
			// Empty loop body
			// Just loop back?
			// fullCode += `${id} --> ${id}\n`; // Infinite loop visual?
		}

		// Exit edge
		// We create a dummy node for "Next" or just return ID as end point?
		// If we return ID as end point, the *next* block in list will connect to Head.
		// That means Loop -> Next.
		// That implies Next is executed *after* loop.
		// So `endId` = `id`.
		// BUT wait, we need to distinguish "Enter Body" edge and "Exit Loop" edge.
		// Mermaid: A --> B; B --> A; A --> C.
		// If we just return `endId = id`, then outer loop will do `id --> next`.
		// That works!

		// We might want to label the exit edge?
		// The outer code does `lastId --> res.startId`.
		// If we want a label on that edge (e.g. "Done"), we can't easily do it from here without changing `processBlockList`.
		// But standard Flowcharts don't always label loop exit if geometry makes it clear.

		endId = id;
	}

	return { startId: id, endId, code: fullCode };
};
