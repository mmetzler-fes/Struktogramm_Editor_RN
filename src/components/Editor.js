import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, Alert, Share, TouchableOpacity, Platform } from 'react-native';
import { Toolbox } from './Toolbox';
import { DiagramNodes } from './DiagramBlock';
import { generateMermaid } from '../utils/generator';
import { DragProvider } from '../context/DragContext';
import { convertGraphToTree, convertTreeToGraph } from '../utils/converter';

const INITIAL_STATE = {
	type: 'root',
	children: [
		{ type: 'process', label: 'Start' },
		{ type: 'process', label: 'End' }
	]
};

// Helper to deep clone and modify
const updateTree = (tree, path, operation) => {
	const newTree = JSON.parse(JSON.stringify(tree));
	let current = newTree;

	// Navigate to the PARENT of the target item/list
	for (let i = 0; i < path.length - 1; i++) {
		current = current[path[i]];
	}

	const lastKey = path[path.length - 1];
	operation(current, lastKey);
	return newTree;
};

export const Editor = () => {
	const [tree, setTree] = useState(INITIAL_STATE);
	const [selectedPath, setSelectedPath] = useState(null);

	const handleSelect = (path) => setSelectedPath(path);

	const handleAddBlock = (type, dropPath, dropIndex) => {
		if (dropPath && dropIndex !== undefined) {
			insertBlock(type, dropPath, dropIndex);
		} else {
			addBlockToSelection(type);
		}
	};

	const insertBlock = (type, path, dropIndex) => {
		const newNode = createNode(type);
		const newTree = updateTree(tree, path, (parent, key) => {
			const list = parent[key];
			if (!Array.isArray(list)) {
				console.error("Drop target is not a list", parent, key);
				return;
			}
			if (dropIndex !== undefined) {
				list.splice(dropIndex, 0, newNode);
			} else {
				list.push(newNode);
			}
		});
		setTree(newTree);
	};

	const addBlockToSelection = (type) => {
		const newNode = createNode(type);

		if (!selectedPath) {
			const newTree = JSON.parse(JSON.stringify(tree));
			const endIdx = Math.max(0, newTree.children.length - 1);
			newTree.children.splice(endIdx, 0, newNode);
			setTree(newTree);
			return;
		}

		const newTree = updateTree(tree, selectedPath, (parentArray, index) => {
			const isRoot = selectedPath.length === 2 && selectedPath[0] === 'children';

			if (isRoot && index === parentArray.length - 1) {
				parentArray.splice(index, 0, newNode);
			} else {
				parentArray.splice(index + 1, 0, newNode);
			}
		});
		setTree(newTree);
	};

	const createNode = (type) => {
		let newNode = { type, label: type };
		if (type === 'decision') {
			newNode.label = 'Condition?'; newNode.yes = []; newNode.no = [];
		} else if (['for_loop', 'while_loop', 'repeat_loop'].includes(type)) {
			newNode.children = [];
			if (type === 'for_loop') newNode.label = 'i=0 to N';
		} else if (type === 'case') { newNode.label = 'Switch'; }
		else if (type === 'command') newNode.label = 'Action';
		return newNode;
	};

	const handleUpdate = (path, updatedNode) => {
		const newTree = updateTree(tree, path, (container, index) => {
			container[index] = updatedNode;
		});
		setTree(newTree);
	};

	const handleDelete = () => {
		if (!selectedPath) return;

		// Prevent deleting Start (0) or End (length-1) in root
		if (selectedPath.length === 2 && selectedPath[0] === 'children') {
			const idx = selectedPath[1];
			if (idx === 0) {
				Alert.alert("Error", "Cannot delete Start block"); return;
			}
		}

		const performDelete = () => {
			let cancelled = false;
			const newTree = updateTree(tree, selectedPath, (container, index) => {
				const isRoot = selectedPath.length === 2 && selectedPath[0] === 'children';
				if (isRoot) {
					if (index === 0 || index === container.length - 1) {
						cancelled = true;
						return;
					}
				}
				container.splice(index, 1);
			});

			if (cancelled) {
				Alert.alert("Error", "Cannot delete Start or End block");
			} else {
				setTree(newTree);
				setSelectedPath(null);
			}
		};

		if (Platform.OS === 'web') {
			performDelete();
		} else {
			Alert.alert("Delete", "Delete selected block?", [
				{ text: "Cancel", style: 'cancel' },
				{ text: "Delete", onPress: performDelete, style: 'destructive' }
			]);
		}
	};

	const handleExport = async () => {
		const mermaidCode = generateMermaid(tree);
		try {
			await Share.share({ message: mermaidCode, title: 'Struktogramm Export' });
		} catch (error) { Alert.alert('Error', error.message); }
	};

	// Save Diagram (Download JSON)
	const handleSaveDiagram = () => {
		if (Platform.OS === 'web') {
			const graphData = convertTreeToGraph(tree);
			const json = JSON.stringify(graphData, null, 2);
			const blob = new Blob([json], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = 'struktogramm.json';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		} else {
			Alert.alert("Info", "Save Diagram is only supported on Web for now.");
		}
	};

	// Load Diagram (Upload JSON)
	const handleLoadDiagram = () => {
		if (Platform.OS === 'web') {
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = 'application/json';
			input.onchange = (e) => {
				const file = e.target.files[0];
				if (!file) return;
				const reader = new FileReader();
				reader.onload = (event) => {
					try {
						const json = JSON.parse(event.target.result);
						if (json && json.nodes && json.edges) {
							// Graph Format (Python compatible)
							const newTree = convertGraphToTree(json);
							setTree(newTree);
						} else if (json && json.type === 'root' && Array.isArray(json.children)) {
							// Native Tree Format
							setTree(json);
						} else {
							Alert.alert("Error", "Invalid diagram file format.");
						}
					} catch (err) {
						Alert.alert("Error", "Failed to parse file.");
					}
				};
				reader.readAsText(file);
			};
			input.click();
		} else {
			Alert.alert("Info", "Load Diagram is only supported on Web for now.");
		}
	};

	return (
		<DragProvider>
			<View style={styles.container}>
				<View style={styles.sidebar}>
					<Toolbox onAddBlock={handleAddBlock} />
				</View>
				<View style={styles.mainContent}>
					<View style={styles.toolbarHeader}>
						<Text style={styles.headerTitle}>Editor</Text>
						<View style={{ flexDirection: 'row', gap: 10 }}>
							<TouchableOpacity onPress={handleSaveDiagram} style={styles.toolbarButton}>
								<Text style={styles.btnText}>Save</Text>
							</TouchableOpacity>
							<TouchableOpacity onPress={handleLoadDiagram} style={styles.toolbarButton}>
								<Text style={styles.btnText}>Load</Text>
							</TouchableOpacity>

							<View style={styles.separator} />

							<TouchableOpacity onPress={handleExport}>
								<Text style={styles.actionBtn}>Export Mermaid</Text>
							</TouchableOpacity>
							{selectedPath && (
								<TouchableOpacity onPress={handleDelete}>
									<Text style={[styles.actionBtn, styles.deleteBtn]}>Delete</Text>
								</TouchableOpacity>
							)}
						</View>
					</View>
					<ScrollView style={styles.canvas} contentContainerStyle={styles.canvasContent}>
						<DiagramNodes
							nodes={tree.children}
							parentPath={['children']}
							onSelect={handleSelect}
							selectedPath={selectedPath ? selectedPath.join(',') : null}
							onUpdate={handleUpdate}
							onDrop={handleAddBlock}
						/>
					</ScrollView>
				</View>
			</View>
		</DragProvider>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		flexDirection: 'row',
		backgroundColor: '#fff',
	},
	sidebar: {
		width: 120,
		borderRightWidth: 1,
		borderColor: '#ccc',
		backgroundColor: '#f8f8f8',
	},
	mainContent: {
		flex: 1,
	},
	canvas: {
		flex: 1,
		padding: 10,
	},
	canvasContent: {
		paddingBottom: 40,
		minHeight: '100%',
	},
	toolbarHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: 10,
		borderBottomWidth: 1,
		borderColor: '#eee',
	},
	headerTitle: { fontSize: 18, fontWeight: 'bold' },
	actionBtn: { color: '#007AFF', fontWeight: 'bold', marginLeft: 10 },
	deleteBtn: { color: 'red' },
	toolbarButton: {
		backgroundColor: '#eee',
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 5,
		borderWidth: 1,
		borderColor: '#ccc',
	},
	btnText: { fontSize: 14 },
	separator: { width: 1, height: 20, backgroundColor: '#ccc', marginHorizontal: 5 }
});
