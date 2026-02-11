import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Svg, Line, Polygon } from 'react-native-svg';
import { DropZone } from './DropZone';

const BLOCK_height = 40;
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
				// Removed fixed height. Let it grow.
				{ width: '100%' } // Ensure full width
			]}
			onPress={onSelect}
			activeOpacity={0.9}
		>
			{isDecision && (
				<Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
					<Line x1="0" y1="0" x2={splitRatio} y2="100" stroke="black" strokeWidth="1" vectorEffect="non-scaling-stroke" />
					<Line x1="100" y1="0" x2={splitRatio} y2="100" stroke="black" strokeWidth="1" vectorEffect="non-scaling-stroke" />
				</Svg>
			)}
			{isCase && (
				<Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
					<Line x1="0" y1="0" x2="100" y2="100" stroke="black" strokeWidth="1" vectorEffect="non-scaling-stroke" />
				</Svg>
			)}

			<View style={isDecision ? { marginBottom: 15, zIndex: 1 } : { width: '100%' }}>
				<TextInput
					style={[styles.input, { textAlign: 'center' }]}
					value={label}
					onChangeText={onUpdateLabel}
					placeholder={type}
					multiline={false}
				/>
			</View>

			{isDecision && (
				<>
					<Text style={[styles.decisionLabel, { left: 5, bottom: 2 }]}>Ja</Text>
					<Text style={[styles.decisionLabel, { right: 5, bottom: 2 }]}>Nein</Text>
				</>
			)}
		</TouchableOpacity>
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

	if (node.type === 'process' && (node.label === 'Start' || node.label === 'End')) {
		return <View style={{ height: 0 }} />;
	}

	if (node.type === 'process' || node.type === 'command' || node.type === 'exit' || node.type === 'subprogram' || node.type === 'case') {
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

	if (node.type === 'decision') {
		return (
			<View style={[styles.blockContainer, isSelected && styles.selectedContainer]}>
				<BlockHeader
					type="decision"
					label={node.label}
					onUpdateLabel={handleUpdateLabel}
					isSelected={isSelected}
					onSelect={handleSelect}
					splitRatio={splitRatio}
				/>
				<View style={styles.row}>
					<View
						style={[styles.column, { borderRightWidth: 1, borderColor: '#000' }]}
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
						style={styles.column}
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
		borderBottomColor: '#ccc',
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: '#fff',
		minHeight: 35,
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
		flexGrow: 1,
		flexShrink: 0,
		// flexBasis: 'auto', // Implicit
		borderColor: '#000',
		// removed global borderLeftWidth to avoid alignment issues
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
