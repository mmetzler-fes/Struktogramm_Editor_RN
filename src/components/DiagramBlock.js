import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Svg, Line, Polygon } from 'react-native-svg';
import { DropZone } from './DropZone';

const BLOCK_height = 40;
const DECISION_HEADER_HEIGHT = 80; // Python style
const INDENT_WIDTH = 20;

const BlockHeader = ({ type, label, onUpdateLabel, isSelected, onSelect, splitRatio = 50 }) => {
	const isDecision = type === 'decision';
	const isLoop = ['for_loop', 'while_loop', 'repeat_loop'].includes(type);
	const isCase = type === 'case';

	return (
		<TouchableOpacity
			style={[
				styles.blockHeader,
				isSelected && styles.selected,
				{ width: '100%' }, // Ensure full width
				isDecision && { minHeight: DECISION_HEADER_HEIGHT, padding: 0 }
			]}
			onPress={onSelect}
			activeOpacity={0.9}
		>
			{isDecision && (
				<Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
					<Polygon
						points={`0,0 ${splitRatio},100 100,0`}
						fill="none"
						stroke="black"
						strokeWidth="1"
						vectorEffect="non-scaling-stroke"
						strokeLinejoin="round"
					/>
				</Svg>
			)}
			{
				isCase && (
					<Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
						<Line x1="0" y1="0" x2="100" y2="100" stroke="black" strokeWidth="1" vectorEffect="non-scaling-stroke" />
					</Svg>
				)
			}

			<View style={isDecision ? { marginBottom: 5, zIndex: 1, padding: 5, width: '100%' } : { width: '100%' }}>
				<TextInput
					style={[styles.input, { textAlign: 'center' }]}
					value={label}
					onChangeText={onUpdateLabel}
					placeholder={type}
					multiline={false}
				/>
			</View>

			{
				isDecision && (
					<>
						<Text style={[styles.decisionLabel, { left: 5, bottom: 5 }]}>Ja</Text>
						<Text style={[styles.decisionLabel, { right: 5, bottom: 5 }]}>Nein</Text>
					</>
				)
			}
		</TouchableOpacity >
	);
};

const Placeholder = ({ onSelect, isSelected }) => (
	<TouchableOpacity
		style={[styles.placeholder, isSelected && styles.selectedPlaceholder]}
		onPress={onSelect}
	>
		<Text style={styles.placeholderText}>Drop here</Text>
	</TouchableOpacity>
);

export function DiagramBlock({ node, path, onSelect, selectedPath, onUpdate, onDrop }) {
	const pathStr = path.join(',');
	const isSelected = selectedPath === pathStr;

	// Hoisted state for widths
	const [widths, setWidths] = useState({ left: 0, right: 0 });
	const [totalWidth, setTotalWidth] = useState(0);
	const splitRatio = (widths.left + widths.right) > 0
		? (widths.left / (widths.left + widths.right)) * 100
		: 50;

	const handleSelect = () => {
		onSelect(path);
	};

	const handleUpdateLabel = (text) => {
		onUpdate(path, { ...node, label: text });
	};

	if (!node) return null;

	// Helper function to calculate minimum width recursively (like Python code)
	const calculateMinWidth = (n) => {
		if (!n) return 100;

		const CHAR_WIDTH_AVG = 8;
		const PADDING_X = 10;
		const MIN_BLOCK_WIDTH = 100;

		const textWidth = (n.label || '').length * CHAR_WIDTH_AVG + PADDING_X * 2;

		if (n.type === 'process' || n.type === 'command' || n.type === 'exit' || n.type === 'subprogram') {
			return Math.max(textWidth, MIN_BLOCK_WIDTH);
		} else if (n.type === 'decision') {
			const yesWidth = calculateMinWidthArray(n.yes || []);
			const noWidth = calculateMinWidthArray(n.no || []);
			return Math.max(yesWidth + noWidth, textWidth);
		} else if (n.type === 'case') {
			let totalBranchWidth = 0;
			if (n.branches) {
				for (const branch of n.branches) {
					const branchWidth = calculateMinWidthArray(branch.children || []);
					const branchTextWidth = (branch.label || '').length * CHAR_WIDTH_AVG + PADDING_X * 2;
					totalBranchWidth += Math.max(branchWidth, branchTextWidth);
				}
			}
			return Math.max(totalBranchWidth, textWidth);
		} else if (['for_loop', 'while_loop', 'repeat_loop'].includes(n.type)) {
			const childrenWidth = calculateMinWidthArray(n.children || []);
			return Math.max(textWidth, childrenWidth + 30);
		}
		return Math.max(textWidth, MIN_BLOCK_WIDTH);
	};

	const calculateMinWidthArray = (nodes) => {
		if (!nodes || nodes.length === 0) return 100;
		let maxWidth = 100;
		for (const node of nodes) {
			maxWidth = Math.max(maxWidth, calculateMinWidth(node));
		}
		return maxWidth;
	};


	if (node.type === 'process' && (node.label === 'Start' || node.label === 'End')) {
		return <View style={{ height: 0 }} />;
	}

	if (node.type === 'process' || node.type === 'command' || node.type === 'exit' || node.type === 'subprogram') {
		return (
			<View style={[styles.blockContainer, isSelected && styles.selectedContainer]}>
				<BlockHeader
					type={node.type}
					label={node.label}
					onUpdateLabel={handleUpdateLabel}
					isSelected={isSelected}
					onSelect={handleSelect}
				/>
			</View>
		);
	}

	if (node.type === 'case') {
		return (
			<View style={[styles.blockContainer, isSelected && styles.selectedContainer]}>
				<BlockHeader
					type="case"
					label={node.label}
					onUpdateLabel={handleUpdateLabel}
					isSelected={isSelected}
					onSelect={handleSelect}
				/>
				<View style={styles.row}>
					{node.branches && node.branches.map((branch, branchIndex) => (
						<View
							key={branchIndex}
							style={[
								styles.column,
								{ flex: 1 },
								branchIndex < node.branches.length - 1 && { borderRightWidth: 1, borderColor: '#000' }
							]}
						>
							<Text style={styles.branchLabel}>{branch.label}</Text>
							<DiagramNodes
								nodes={branch.children}
								parentPath={[...path, 'branches', branchIndex, 'children']}
								onSelect={onSelect}
								selectedPath={selectedPath}
								onUpdate={onUpdate}
								onDrop={onDrop}
							/>
						</View>
					))}
				</View>
			</View>
		);
	}


	if (node.type === 'decision') {
		// Calculate minimum widths recursively for proportional width distribution
		const leftMinWidth = calculateMinWidthArray(node.yes || []);
		const rightMinWidth = calculateMinWidthArray(node.no || []);

		// Use these as flex values (they represent relative proportions)
		const leftFlex = leftMinWidth;
		const rightFlex = rightMinWidth;

		// Calculate splitRatio from min widths to avoid timing issues
		// Use measured total width from the row to ensure alignment
		const measuredTotal = totalWidth > 0 ? totalWidth : (widths.left + widths.right);
		const minTotal = leftMinWidth + rightMinWidth;

		const decisionSplitRatio = (measuredTotal > 0 && widths.left > 0)
			? (widths.left / measuredTotal) * 100
			: (minTotal > 0 ? (leftMinWidth / minTotal) * 100 : 50);

		if (!Number.isFinite(decisionSplitRatio)) {
			console.warn('Invalid split ratio calculated:', decisionSplitRatio, widths, leftMinWidth, rightMinWidth);
		}
		const safeSplitRatio = Number.isFinite(decisionSplitRatio) ? decisionSplitRatio : 50;
		// console.log('Decision Split Ratio:', safeSplitRatio, widths);

		// console.log(`Decision Split: Left=${widths.left}, Right=${widths.right}, Ratio=${decisionSplitRatio}`);

		return (
			<View style={[styles.blockContainer, isSelected && styles.selectedContainer]}>
				<BlockHeader
					type="decision"
					label={node.label}
					onUpdateLabel={handleUpdateLabel}
					isSelected={isSelected}
					onSelect={handleSelect}
					splitRatio={safeSplitRatio}
				/>
				<View
					style={styles.row}
					onLayout={(e) => setTotalWidth(e.nativeEvent.layout.width)}
				>
					<View
						style={[
							styles.column,
							{
								flex: leftFlex,
								borderRightWidth: 1,
								borderColor: '#000'
							}
						]}
						onLayout={(e) => setWidths(prev => ({ ...prev, left: e.nativeEvent.layout.width }))}
					>
						<DiagramNodes
							nodes={node.yes}
							parentPath={[...path, 'yes']}
							onSelect={onSelect}
							selectedPath={selectedPath}
							onUpdate={onUpdate}
							onDrop={onDrop}
						/>
					</View>
					<View
						style={[
							styles.column,
							{ flex: rightFlex }
						]}
						onLayout={(e) => setWidths(prev => ({ ...prev, right: e.nativeEvent.layout.width }))}
					>
						<DiagramNodes
							nodes={node.no}
							parentPath={[...path, 'no']}
							onSelect={onSelect}
							selectedPath={selectedPath}
							onUpdate={onUpdate}
							onDrop={onDrop}
						/>
					</View>
				</View>
			</View>
		);
	}

	if (['for_loop', 'while_loop', 'repeat_loop'].includes(node.type)) {
		return (
			<View style={[styles.blockContainer, isSelected && styles.selectedContainer]}>
				<View style={styles.row}>
					<View style={styles.loopSidebar} />
					<View style={styles.loopMain}>
						<BlockHeader
							type={node.type}
							label={node.label}
							onUpdateLabel={handleUpdateLabel}
							isSelected={isSelected}
							onSelect={handleSelect}
						/>
						<DiagramNodes
							nodes={node.children}
							parentPath={[...path, 'children']}
							onSelect={onSelect}
							selectedPath={selectedPath}
							onUpdate={onUpdate}
							onDrop={onDrop}
						/>
					</View>
				</View>
			</View>
		);
	}

	return (
		<View style={styles.blockContainer}>
			<Text>Unknown Type: {node.type}</Text>
		</View>
	);
}

export function DiagramNodes({ nodes, parentPath, onSelect, selectedPath, onUpdate, onDrop }) {
	const isRoot = parentPath.length === 1 && parentPath[0] === 'children';

	const renderDropZone = (index) => {
		if (isRoot) {
			if (index === 0) return null;
			if (index === nodes.length) return null;
		}

		return (
			<DropZone
				key={`drop-${parentPath.join('-')}-${index}`}
				path={parentPath}
				index={index}
				onDrop={(p, item) => onDrop(item, p, index)}
			/>
		);
	};

	if (!nodes || nodes.length === 0) {
		return (
			<View style={{ minHeight: 40, justifyContent: 'center' }}>
				<DropZone
					path={parentPath}
					index={0}
					onDrop={(p, item) => onDrop(item, p, 0)}
					isHorizontal={false}
				/>
				<Placeholder
					onSelect={() => onSelect([...parentPath, 0])}
					isSelected={selectedPath === [...parentPath, 0].join(',')}
				/>
			</View>
		);
	}

	return (
		<View style={{ width: '100%' }}>
			{renderDropZone(0)}

			{nodes.map((node, index) => (
				<React.Fragment key={index}>
					<DiagramBlock
						node={node}
						path={[...parentPath, index]}
						onSelect={onSelect}
						selectedPath={selectedPath}
						onUpdate={onUpdate}
						onDrop={onDrop}
					/>
					{renderDropZone(index + 1)}
				</React.Fragment>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	blockContainer: {
		width: '100%',
		borderWidth: 1,
		borderColor: '#000',
		backgroundColor: '#fff',
	},
	blockHeader: {
		padding: 5,
		borderBottomWidth: 1,
		borderBottomColor: '#000', // Python uses black
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: '#fff',
		minHeight: 35, // Default min height
		overflow: 'hidden',
	},
	selected: {
		backgroundColor: '#e6f7ff',
		borderColor: '#1890ff',
		borderWidth: 2,
	},
	row: {
		flexDirection: 'row',
		width: '100%',
	},
	column: {
		flexShrink: 0,
		// flexBasis: 'auto', // Implicit
		borderColor: '#000',
		// removed global borderLeftWidth to avoid alignment issues
		// removed flexGrow: 1 to allow dynamic flex values for decision branches
	},
	input: {
		width: '100%',
		textAlign: 'center',
	},
	decisionLabel: {
		fontSize: 10,
		position: 'absolute',
		color: '#666',
	},
	loopSidebar: {
		width: 20,
		backgroundColor: '#ccc',
		borderRightWidth: 1,
		borderColor: '#000',
	},
	loopContent: {
		flex: 1,
	},
	placeholder: {
		height: 30, // Slightly smaller placeholder
		justifyContent: 'center',
		alignItems: 'center',
		borderWidth: 1,
		borderColor: 'rgba(0,0,0,0.1)', // softer border
		borderStyle: 'dashed',
		backgroundColor: 'rgba(0,0,0,0.02)',
		margin: 2,
		width: '100%',
	},
	selectedPlaceholder: {
		backgroundColor: '#e6f7ff',
		borderColor: '#1890ff',
		borderStyle: 'solid',
	},
	placeholderText: {
		color: '#999',
		fontSize: 12,
		fontStyle: 'italic',
	},
	selectedContainer: {
		borderColor: '#1890ff',
		borderWidth: 2,
	},
	loopMain: {
		flex: 1,
	},
	branchLabel: {
		fontSize: 10,
		textAlign: 'center',
		color: '#666',
		padding: 2,
		backgroundColor: '#f0f0f0',
	},
});
