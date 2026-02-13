// Port of converter.py to TypeScript/JavaScript
// Original Author: mmetzler-fes
// Ported for React Native

const FONT_SIZE = 14;
const CHAR_WIDTH_AVG = 8;
const LINE_HEIGHT = 20;
const PADDING_X = 10;
const PADDING_Y = 10;
const MIN_BLOCK_WIDTH = 100;

export class Graph {
	constructor() {
		this.nodes = {};
		this.edges = [];
	}

	addNode(id, data = {}) {
		if (!this.nodes[id]) {
			this.nodes[id] = { id, ...data };
		} else {
			this.nodes[id] = { ...this.nodes[id], ...data };
		}
	}

	addEdge(from, to, data = {}) {
		this.edges.push({ from, to, ...data });
	}

	getSuccessors(nodeId) {
		return this.edges.filter(e => e.from === nodeId).map(e => e.to);
	}

	getInDegree(nodeId) {
		return this.edges.filter(e => e.to === nodeId).length;
	}

	getEdgeData(from, to) {
		return this.edges.find(e => e.from === from && e.to === to) || {};
	}
}

function parseNodeStr(nodeStr) {
	const m = nodeStr.match(/(\w+)\s*(\[\".*?\"\]|\{\".*?\"\}|\(\[\".*?\"\]\)|\(\(\".*?\"\)\)|\(\[.*?\]\))?/);
	if (!m) return [null, null, null];

	const nodeId = m[1];
	const rest = m[2];
	let label = nodeId;
	let nodeType = 'process';

	if (rest) {
		if (rest.startsWith('["')) { label = rest.slice(2, -2); nodeType = 'process'; }
		else if (rest.startsWith('{"')) { label = rest.slice(2, -2); nodeType = 'decision'; }
		else if (rest.startsWith('(["')) { label = rest.slice(3, -3); nodeType = 'terminal'; }
		else if (rest.startsWith('(("')) { label = rest.slice(3, -3); nodeType = 'loop'; }
		else if (rest.startsWith('([')) { label = rest.slice(2, -2); nodeType = 'terminal'; }
	}
	return [nodeId, label, nodeType];
}

function parseMermaid(content) {
	const G = new Graph();
	const lines = content.split('\n');

	for (let line of lines) {
		line = line.trim();
		if (!line || line.startsWith('graph') || line.startsWith('flowchart') || line.startsWith('classDef') || line.startsWith('%%') || line.startsWith('subgraph')) {
			continue;
		}

		if (line.includes('-->')) {
			const parts = line.split('-->');
			let leftPart = parts[0].trim();
			let rightPart = parts[1].trim();

			const [leftId, leftLabel, leftType] = parseNodeStr(leftPart);
			if (leftId) G.addNode(leftId, { label: leftLabel, type: leftType });

			let edgeLabel = "";
			if (rightPart.startsWith('|')) {
				const endPipe = rightPart.indexOf('|', 1);
				if (endPipe !== -1) {
					edgeLabel = rightPart.substring(1, endPipe);
					rightPart = rightPart.substring(endPipe + 1).trim();
				}
			}

			const [rightId, rightLabel, rightType] = parseNodeStr(rightPart);
			if (rightId) G.addNode(rightId, { label: rightLabel, type: rightType });

			if (leftId && rightId) {
				G.addEdge(leftId, rightId, { label: edgeLabel });
			}
		} else {
			const [nodeId, nodeLabel, nodeType] = parseNodeStr(line);
			if (nodeId) G.addNode(nodeId, { label: nodeLabel, type: nodeType });
		}
	}

	let startNode = null;
	const nodeIds = Object.keys(G.nodes);
	for (const node of nodeIds) {
		if (G.getInDegree(node) === 0) {
			startNode = node;
			break;
		}
	}
	if (!startNode && nodeIds.length > 0) {
		startNode = nodeIds[0];
	}

	return { graph: G, startNode };
}

function findMergeNode(G, node1, node2, forbiddenNode = null) {
	const visited1 = new Set();
	const queue1 = [node1];
	const visited2 = new Set();
	const queue2 = [node2];

	let iterCount = 0;
	while ((queue1.length || queue2.length) && iterCount < 1000) {
		iterCount++;
		if (queue1.length) {
			const n = queue1.shift();
			if (visited2.has(n)) return n;
			if (!visited1.has(n)) {
				visited1.add(n);
				const successors = G.getSuccessors(n);
				for (const succ of successors) {
					if (succ !== forbiddenNode) queue1.push(succ);
				}
			}
		}
		if (queue2.length) {
			const n = queue2.shift();
			if (visited1.has(n)) return n;
			if (!visited2.has(n)) {
				visited2.add(n);
				const successors = G.getSuccessors(n);
				for (const succ of successors) {
					if (succ !== forbiddenNode) queue2.push(succ);
				}
			}
		}
	}
	return null;
}

export function buildStructure(G, currentNode, stopNode, visited) {
	const blocks = [];
	while (currentNode && currentNode !== stopNode) {
		if (visited.has(currentNode)) break;
		visited.add(currentNode);

		const nodeData = G.nodes[currentNode];
		const label = nodeData.label || currentNode;
		const successors = G.getSuccessors(currentNode);

		if (successors.length === 2) {
			const nodeType = nodeData.type || 'process';

			if (nodeType === 'loop' || nodeType === 'terminal' || ['for_loop', 'while_loop', 'repeat_loop'].includes(nodeType)) {
				// Loop
				const edge1 = G.getEdgeData(currentNode, successors[0]);
				const label1 = (edge1.label || '').toLowerCase();

				let exitNode, bodyStartNode;
				if (label1.includes('exit')) {
					exitNode = successors[0];
					bodyStartNode = successors[1];
				} else {
					bodyStartNode = successors[0];
					exitNode = successors[1];
				}

				const bodyBlocks = buildStructure(G, bodyStartNode, currentNode, new Set(visited));
				blocks.push({
					type: nodeType === 'terminal' || nodeType === 'loop' ? 'loop' : nodeType, // Normalize type if needed, or keep specific loop type
					label,
					children: bodyBlocks
				});
				currentNode = exitNode;
			} else {
				// Decision
				const edge1 = G.getEdgeData(currentNode, successors[0]);
				const label1 = (edge1.label || '').toLowerCase();

				let isStandardDecision = false;
				if (label1.includes('ja') || label1.includes('yes') || label1.includes('true') ||
					label1.includes('nein') || label1.includes('no') || label1.includes('false')) {
					isStandardDecision = true;
				}

				if (isStandardDecision) {
					const mergeNode = findMergeNode(G, successors[0], successors[1], currentNode);
					let yesNode, noNode;
					if (label1.includes('ja') || label1.includes('yes') || label1.includes('true')) {
						yesNode = successors[0]; noNode = successors[1];
					} else {
						yesNode = successors[1]; noNode = successors[0];
					}

					const yesBlock = buildStructure(G, yesNode, mergeNode, new Set(visited));
					const noBlock = buildStructure(G, noNode, mergeNode, new Set(visited));

					blocks.push({
						type: 'decision', label, yes: yesBlock, no: noBlock
					});
					currentNode = mergeNode;
				} else {
					// Case fallback
					const mergeNode = findMergeNode(G, successors[0], successors[1], currentNode);
					const branches = [];
					for (const succ of successors) {
						const edge = G.getEdgeData(currentNode, succ);
						const bLabel = edge.label || '';
						const bBlocks = buildStructure(G, succ, mergeNode, new Set(visited));
						branches.push({ label: bLabel, children: bBlocks });
					}
					blocks.push({ type: 'case', label, branches });
					currentNode = mergeNode;
				}
			}
		} else if (successors.length >= 2) {
			// Case
			let mergeNode = findMergeNode(G, successors[0], successors[1], currentNode);
			for (let i = 2; i < successors.length; i++) {
				if (!mergeNode) break;
				mergeNode = findMergeNode(G, mergeNode, successors[i], currentNode);
			}

			if (!mergeNode) {
				blocks.push({ type: 'process', label });
				currentNode = successors[0];
				continue;
			}

			const branches = [];
			for (const succ of successors) {
				const edge = G.getEdgeData(currentNode, succ);
				const bLabel = edge.label || '';
				const bBlocks = buildStructure(G, succ, mergeNode, new Set(visited));
				branches.push({ label: bLabel, children: bBlocks });
			}
			blocks.push({ type: 'case', label, branches });
			currentNode = mergeNode;
		} else if (successors.length === 1) {
			// Skip empty/dummy
			if ((!label || !label.trim()) && nodeType !== 'process' && nodeType !== 'command' && nodeType !== 'subprogram') {
				currentNode = successors[0];
				continue;
			}
			blocks.push({ type: nodeType, label });
			currentNode = successors[0];
		} else {
			if (nodeType !== 'end' && nodeType !== 'start') {
				blocks.push({ type: nodeType, label });
			}
			currentNode = null;
		}
	}
	return blocks;
}

function calculateMinWidths(blocks) {
	let maxWidth = MIN_BLOCK_WIDTH;
	for (const block of blocks) {
		const textWidth = block.label.length * CHAR_WIDTH_AVG + PADDING_X * 2;
		if (block.type === 'process') {
			block.min_width = Math.max(textWidth, MIN_BLOCK_WIDTH);
		} else if (block.type === 'decision') {
			const yesWidth = calculateMinWidths(block.yes);
			const noWidth = calculateMinWidths(block.no);
			block.min_width = Math.max(yesWidth + noWidth, textWidth);
			block.yes_min_width = yesWidth;
			block.no_min_width = noWidth;
		} else if (block.type === 'case') {
			let totalBWidth = 0;
			for (const branch of block.branches) {
				const bWidth = calculateMinWidths(branch.children);
				const bTextWidth = branch.label.length * CHAR_WIDTH_AVG + PADDING_X * 2;
				branch.min_width = Math.max(bWidth, bTextWidth);
				totalBWidth += branch.min_width;
			}
			block.min_width = Math.max(totalBWidth, textWidth);
		} else if (block.type === 'loop') {
			const childrenWidth = calculateMinWidths(block.children);
			block.min_width = Math.max(textWidth, childrenWidth + 30);
		} else {
			block.min_width = Math.max(textWidth, MIN_BLOCK_WIDTH);
		}
		maxWidth = Math.max(maxWidth, block.min_width);
	}
	return maxWidth;
}

function calculateHeights(blocks, width) {
	let totalH = 0;
	for (const block of blocks) {
		const textAreaWidth = width - PADDING_X * 2;
		const textLen = block.label.length * CHAR_WIDTH_AVG;
		const lines = Math.ceil(textLen / Math.max(1, textAreaWidth));
		const textHeight = lines * LINE_HEIGHT + PADDING_Y * 2;

		if (block.type === 'process') {
			block.height = Math.max(40, textHeight);
			totalH += block.height;
		} else if (block.type === 'decision') {
			const yesMin = block.yes_min_width;
			const noMin = block.no_min_width;
			const totalMin = yesMin + noMin;

			const yesW = width * (yesMin / totalMin);
			const noW = width - yesW;

			const yesH = calculateHeights(block.yes, yesW);
			const noH = calculateHeights(block.no, noW);

			const contentHeight = Math.max(yesH, noH);
			const headerHeight = Math.max(40, textHeight + 20);

			block.height = headerHeight + contentHeight;
			block.header_height = headerHeight;
			block.content_height = contentHeight;
			block.yes_width = yesW;
			block.no_width = noW;
			totalH += block.height;
		} else if (block.type === 'case') {
			const totalMin = block.branches.reduce((acc, b) => acc + b.min_width, 0) || 1;
			let maxContentH = 0;
			for (const branch of block.branches) {
				const ratio = branch.min_width / totalMin;
				const bWidth = width * ratio;
				branch.width = bWidth;
				const h = calculateHeights(branch.children, bWidth);
				maxContentH = Math.max(maxContentH, h);
			}
			const headerHeight = Math.max(40, textHeight + 20);
			block.height = headerHeight + maxContentH;
			block.header_height = headerHeight;
			block.content_height = maxContentH;
			totalH += block.height;
		} else if (block.type === 'loop') {
			const spacerWidth = 30;
			const contentWidth = width - spacerWidth;
			const contentH = calculateHeights(block.children, contentWidth);
			const headerHeight = Math.max(30, textHeight);

			block.height = headerHeight + contentH;
			block.header_height = headerHeight;
			block.content_height = contentH;
			block.spacer_width = spacerWidth;
			block.content_width = contentWidth;
			totalH += block.height;
		}
	}
	return totalH;
}

function wrapText(text, maxWidth) {
	const words = text.split(' ');
	const lines = [];
	let currentLine = [];
	let currentLen = 0;

	for (const word of words) {
		const wordLen = word.length * CHAR_WIDTH_AVG;
		if (currentLen + wordLen <= maxWidth) {
			currentLine.push(word);
			currentLen += wordLen + CHAR_WIDTH_AVG;
		} else {
			if (currentLine.length) lines.push(currentLine.join(' '));
			currentLine = [word];
			currentLen = wordLen;
		}
	}
	if (currentLine.length) lines.push(currentLine.join(' '));
	if (lines.length === 0) lines.push(text);
	return lines;
}

function escapeHtml(text) {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function renderBlocks(blocks, x, y, width) {
	let svg = "";
	let currentY = y;

	for (const block of blocks) {
		if (block.type === 'process') {
			const h = block.height;
			svg += `<rect x="${x}" y="${currentY}" width="${width}" height="${h}" fill="white" stroke="black" stroke-width="1"/>`;
			const lines = wrapText(block.label, width - PADDING_X * 2);
			let textY = currentY + PADDING_Y + FONT_SIZE / 2;
			for (const line of lines) {
				svg += `<text x="${x + 10}" y="${textY}" font-size="${FONT_SIZE}" font-family="Arial, sans-serif">${escapeHtml(line)}</text>`;
				textY += LINE_HEIGHT;
			}
			currentY += h;
		} else if (block.type === 'decision') {
			const headerH = block.header_height;
			const contentH = block.content_height;
			const yesW = block.yes_width;
			const noW = block.no_width;

			// Header - White background for IF, but with V-shape lines
			svg += `<rect x="${x}" y="${currentY}" width="${width}" height="${headerH}" fill="white" stroke="black" stroke-width="1"/>`;
			svg += `<line x1="${x}" y1="${currentY}" x2="${x + yesW}" y2="${currentY + headerH}" stroke="black" stroke-width="1"/>`;
			svg += `<line x1="${x + width}" y1="${currentY}" x2="${x + yesW}" y2="${currentY + headerH}" stroke="black" stroke-width="1"/>`;

			// Label
			const blockCenterX = x + width / 2;
			const intersectionX = x + yesW;
			const labelX = (blockCenterX + intersectionX) / 2;

			svg += `<text x="${labelX}" y="${currentY + headerH / 2}" text-anchor="middle" font-size="${FONT_SIZE}" font-family="Arial, sans-serif">${escapeHtml(block.label)}</text>`;

			// True/False
			svg += `<text x="${x + yesW / 2}" y="${currentY + headerH - 5}" text-anchor="middle" font-size="12" font-family="Arial, sans-serif">Ja</text>`;
			svg += `<text x="${x + yesW + noW / 2}" y="${currentY + headerH - 5}" text-anchor="middle" font-size="12" font-family="Arial, sans-serif">Nein</text>`;

			// Branches
			svg += renderBlocks(block.yes, x, currentY + headerH, yesW);
			svg += renderBlocks(block.no, x + yesW, currentY + headerH, noW);

			// Fill empty space
			const yesContentH = block.yes.reduce((acc, b) => acc + (b.height || 0), 0);
			const noContentH = block.no.reduce((acc, b) => acc + (b.height || 0), 0);

			if (yesContentH < contentH) {
				svg += `<rect x="${x}" y="${currentY + headerH + yesContentH}" width="${yesW}" height="${contentH - yesContentH}" fill="white" stroke="black" stroke-width="1"/>`;
			}
			if (noContentH < contentH) {
				svg += `<rect x="${x + yesW}" y="${currentY + headerH + noContentH}" width="${noW}" height="${contentH - noContentH}" fill="white" stroke="black" stroke-width="1"/>`;
			}

			currentY += headerH + contentH;
		} else if (block.type === 'case') {
			const headerH = block.header_height;
			const contentH = block.content_height;

			// Render Header
			svg += `<rect x="${x}" y="${currentY}" width="${width}" height="${headerH}" fill="white" stroke="black" stroke-width="1"/>`;

			// Geometry for Fan
			const branches = block.branches;
			const nBranches = branches.length;
			const splitYRatio = 0.6;
			const splitYPx = headerH * splitYRatio;

			// Label (Top Center)
			svg += `<text x="${x + width / 2}" y="${currentY + splitYPx / 2 + 5}" text-anchor="middle" font-size="${FONT_SIZE}" font-family="Arial, sans-serif">${escapeHtml(block.label)}</text>`;

			// Draw left diagonal
			const branch0W = branches[0].width;
			const p1X = x + branch0W;
			svg += `<line x1="${x}" y1="${currentY}" x2="${p1X}" y2="${currentY + splitYPx}" stroke="black" stroke-width="1"/>`;

			// Render Branches and Header Parts
			let renderX = x;

			for (let i = 0; i < branches.length; i++) {
				const branch = branches[i];
				const bWidth = branch.width;

				// Branch Label
				const labelCenterX = renderX + bWidth / 2;
				svg += `<text x="${labelCenterX}" y="${currentY + headerH - 5}" text-anchor="middle" font-size="12" font-family="Arial, sans-serif">${escapeHtml(branch.label)}</text>`;

				// Vertical Separator (except for last one)
				if (i < nBranches - 1) {
					const sepX = renderX + bWidth;
					svg += `<line x1="${sepX}" y1="${currentY + splitYPx}" x2="${sepX}" y2="${currentY + headerH}" stroke="black" stroke-width="1"/>`;
				}

				// Render Block Content
				svg += renderBlocks(branch.children, renderX, currentY + headerH, bWidth);

				// Fill Empty Space
				const bContentH = branch.children.reduce((acc, b) => acc + (b.height || 0), 0);
				if (bContentH < contentH) {
					svg += `<rect x="${renderX}" y="${currentY + headerH + bContentH}" width="${bWidth}" height="${contentH - bContentH}" fill="white" stroke="black" stroke-width="1"/>`;
				}

				renderX += bWidth;
			}

			// Right Diagonal
			const lastBranchW = branches[branches.length - 1].width;
			const p2X = x + width - lastBranchW;
			svg += `<line x1="${x + width}" y1="${currentY}" x2="${p2X}" y2="${currentY + splitYPx}" stroke="black" stroke-width="1"/>`;

			// Middle Line (if needed)
			if (nBranches > 2) {
				svg += `<line x1="${p1X}" y1="${currentY + splitYPx}" x2="${p2X}" y2="${currentY + splitYPx}" stroke="black" stroke-width="1"/>`;
			}

			currentY += headerH + contentH;
		} else if (block.type === 'loop') {
			const headerH = block.header_height;
			const contentH = block.content_height;
			const spacerW = block.spacer_width;
			const contentW = block.content_width;

			// L-Shape Polygon (Header + Spacer)
			const p1 = `${x},${currentY}`;
			const p2 = `${x + width},${currentY}`;
			const p3 = `${x + width},${currentY + headerH}`;
			const p4 = `${x + spacerW},${currentY + headerH}`;
			const p5 = `${x + spacerW},${currentY + headerH + contentH}`;
			const p6 = `${x},${currentY + headerH + contentH}`;

			svg += `<polygon points="${p1} ${p2} ${p3} ${p4} ${p5} ${p6}" fill="#e2e8f0" stroke="black" stroke-width="1"/>`;

			// Label
			svg += `<text x="${x + 10}" y="${currentY + headerH / 2 + 5}" font-size="${FONT_SIZE}" font-family="Arial, sans-serif">${escapeHtml(block.label)}</text>`;

			// Content Area (White)
			svg += `<rect x="${x + spacerW}" y="${currentY + headerH}" width="${contentW}" height="${contentH}" fill="white" stroke="black" stroke-width="1"/>`;

			// Render Children
			svg += renderBlocks(block.children, x + spacerW, currentY + headerH, contentW);

			currentY += headerH + contentH;
		}
	}
	return svg;
}


export function convertMermaidToNsd(mermaidContent) {
	const { graph, startNode } = parseMermaid(mermaidContent);
	if (!startNode) return '<svg><text>Error: No start node found</text></svg>';

	const structuredTree = buildStructure(graph, startNode, null, new Set());
	const totalMinWidth = calculateMinWidths(structuredTree);
	const width = Math.max(800, totalMinWidth);
	const totalHeight = calculateHeights(structuredTree, width);
	const svgContent = renderBlocks(structuredTree, 0, 0, width);

	return `<svg width="${width}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg" style="font-family: Arial, sans-serif;">${svgContent}</svg>`;
}

export function convertGraphToTree(graphData) {
	const G = new Graph();
	if (!graphData.nodes || !graphData.edges) return { type: 'root', children: [] };

	graphData.nodes.forEach(node => {
		G.addNode(node.id, { label: node.text || node.label, type: node.type });
	});

	graphData.edges.forEach(edge => {
		G.addEdge(edge.from, edge.to, { label: edge.label });
	});

	// Find start node (assumed to be 'start_node_id' or first node)
	let startNodeId = 'start_node_id';
	if (!G.nodes[startNodeId]) {
		// Fallback: find node with 0 in-degree
		const nodeIds = Object.keys(G.nodes);
		for (const node of nodeIds) {
			if (G.getInDegree(node) === 0) {
				startNodeId = node;
				break;
			}
		}
	}

	// We need to skip 'start' node content but use it as entry point
	const successors = G.getSuccessors(startNodeId);
	let firstRealNodeId = successors.length > 0 ? successors[0] : null;

	// In Python script logic: start -> firstNode. 
	// buildStructure starts from firstRealNodeId.
	// But we need to handle if start node IS the first node (if implicit).
	// If the start node is actually of type 'start', we skip it.
	const startNodeData = G.nodes[startNodeId];
	if (startNodeData && startNodeData.type === 'start') {
		// use successor
	} else {
		firstRealNodeId = startNodeId;
	}

	if (!firstRealNodeId && startNodeId && startNodeData.type === 'start') {
		// Empty diagram
		return { type: 'root', children: [] };
	}

	const children = buildStructure(G, firstRealNodeId, 'end_node_id', new Set());
	return { type: 'root', children };
}

export function convertTreeToGraph(tree) {
	const nodes = [];
	const edges = [];

	const addNode = (type, text) => {
		const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
		nodes.push({ id, type, text });
		return id;
	};

	const addEdge = (from, to, label = "") => {
		edges.push({ from, to, label });
	};

	const startId = 'start_node_id';
	const endId = 'end_node_id';
	nodes.push({ id: startId, type: 'start', text: 'Start' });
	nodes.push({ id: endId, type: 'end', text: 'End' });

	// Recursive builder
	const processBlock = (block, entryId) => {
		if (!block) return entryId;

		const type = block.type;
		const label = block.label || '';

		if (type === 'process' || type === 'command' || type === 'subprogram' || type === 'exit') {
			const nodeId = addNode(type, label);
			addEdge(entryId, nodeId);
			return nodeId;
		} else if (type === 'decision' || type === 'if_else') {
			const nodeId = addNode('if_else', label);
			addEdge(entryId, nodeId);

			const mergeId = addNode('join', ' ');

			// True Branch
			const trueDummyId = addNode('join', ' ');
			addEdge(nodeId, trueDummyId, 'Ja');

			let lastTrueId = trueDummyId;
			if (block.yes && block.yes.length > 0) {
				// If we have children, we process them sequentially
				lastTrueId = processSequence(block.yes, trueDummyId);
			}
			addEdge(lastTrueId, mergeId);

			// False Branch
			const falseDummyId = addNode('join', ' ');
			addEdge(nodeId, falseDummyId, 'Nein');

			let lastFalseId = falseDummyId;
			if (block.no && block.no.length > 0) {
				lastFalseId = processSequence(block.no, falseDummyId);
			}
			addEdge(lastFalseId, mergeId);

			return mergeId;
		} else if (['for_loop', 'while_loop', 'repeat_loop'].includes(type) || type === 'loop') {
			// Loop
			const nodeId = addNode(type, label);
			addEdge(entryId, nodeId);

			const bodyDummyId = addNode('join', ' ');
			addEdge(nodeId, bodyDummyId);

			let lastBodyId = bodyDummyId;
			if (block.children && block.children.length > 0) {
				lastBodyId = processSequence(block.children, bodyDummyId);
			}
			// Back edge
			addEdge(lastBodyId, nodeId);

			return nodeId; // The loop node is its own exit source for the next block (via 'Exit' edge)
		} else if (type === 'case') {
			const nodeId = addNode('case', label);
			addEdge(entryId, nodeId);

			const mergeId = addNode('join', ' ');

			if (block.branches) {
				block.branches.forEach(branch => {
					const branchDummyId = addNode('join', ' ');
					addEdge(nodeId, branchDummyId, branch.label);

					let lastBranchId = branchDummyId;
					if (branch.children && branch.children.length > 0) {
						lastBranchId = processSequence(branch.children, branchDummyId);
					}
					addEdge(lastBranchId, mergeId);
				});
			}
			return mergeId;
		}

		return entryId;
	};

	const processSequence = (blocks, startNodeId) => {
		let currentId = startNodeId;
		for (const block of blocks) {
			const nextId = processBlock(block, currentId);
			// Specifically for loop, the nextId returned is the Loop Head.
			// But the edges are already added: entry -> loopHead.
			// Wait, processBlock adds edge entryId -> nodeId.
			// So for loop: currentId -> LoopHead.

			// However, after Loop, we need to connect LoopHead -> NextBlock with 'Exit' label.
			// My default `addEdge(entryId, nodeId)` doesn't handle 'Exit' label.

			// We need to specialized handling.

			// Let's refactor processBlock to NOT add edge from entryId?
			// No, keeping it is simpler, but we need to handle labels.

			currentId = nextId;
		}
		return currentId;
	};

	// Redo process with cleaner logic for edges
	// processBlock(block) returns { entryId, exitId }
	// No, we are building a graph given an entry point.

	// Re-implementation of Recursive Builder
	const buildFromBlocks = (blocks, predecessorId) => {
		let currentPred = predecessorId;

		for (const block of blocks) {
			const type = block.type === 'decision' ? 'if_else' : block.type;
			const label = block.label || '';
			const nodeId = addNode(type, label);

			// Connect Predecessor -> Node
			let edgeLabel = "";
			// Check if predecessor was a loop, if so label is Exit.
			// But we don't know predecessor type easily unless we look it up.
			const predNode = nodes.find(n => n.id === currentPred);
			if (predNode && ['for_loop', 'while_loop', 'repeat_loop', 'loop'].includes(predNode.type)) {
				edgeLabel = "Exit";
			}

			addEdge(currentPred, nodeId, edgeLabel);

			if (type === 'if_else') {
				const mergeId = addNode('join', ' ');

				// True
				const trueDummy = addNode('join', ' ');
				addEdge(nodeId, trueDummy, 'Ja');
				const lastTrue = buildFromBlocks(block.yes || [], trueDummy);
				addEdge(lastTrue, mergeId);

				// False
				const falseDummy = addNode('join', ' ');
				addEdge(nodeId, falseDummy, 'Nein');
				const lastFalse = buildFromBlocks(block.no || [], falseDummy);
				addEdge(lastFalse, mergeId);

				currentPred = mergeId;
			} else if (['for_loop', 'while_loop', 'repeat_loop', 'loop'].includes(type)) {
				// Loop
				const bodyDummy = addNode('join', ' ');
				addEdge(nodeId, bodyDummy); // Loop to Body

				const lastBody = buildFromBlocks(block.children || [], bodyDummy);
				addEdge(lastBody, nodeId); // Back edge

				currentPred = nodeId; // Next block connects from LoopHead (Exit)
			} else if (type === 'case') {
				const mergeId = addNode('join', ' ');
				if (block.branches) {
					block.branches.forEach(branch => {
						const branchDummy = addNode('join', ' ');
						addEdge(nodeId, branchDummy, branch.label);
						const lastBranch = buildFromBlocks(branch.children || [], branchDummy);
						addEdge(lastBranch, mergeId);
					});
				}
				currentPred = mergeId;
			} else {
				currentPred = nodeId;
			}
		}
		return currentPred;
	};

	const lastNodeId = buildFromBlocks(tree.children, startId);

	// Connect last node to End
	let finalLabel = "";
	const lastNode = nodes.find(n => n.id === lastNodeId);
	if (lastNode && ['for_loop', 'while_loop', 'repeat_loop', 'loop'].includes(lastNode.type)) {
		finalLabel = "Exit";
	}
	addEdge(lastNodeId, endId, finalLabel);

	return { nodes, edges };
}
