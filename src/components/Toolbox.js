import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { DraggableTool } from './DraggableTool';

const TOOL_TYPES = [
	{ type: 'process', label: 'Instruction' },
	{ type: 'decision', label: 'If / Else' },
	{ type: 'for_loop', label: 'For Loop' },
	{ type: 'while_loop', label: 'While Loop' },
	{ type: 'repeat_loop', label: 'Repeat Loop' },
	{ type: 'case', label: 'Case' },
	{ type: 'subprogram', label: 'Subprogram' },
	{ type: 'exit', label: 'Exit' },
];

export const Toolbox = ({ onAddBlock }) => {
	return (
		<View style={styles.container}>
			<Text style={styles.title}>Toolbox</Text>
			<ScrollView contentContainerStyle={styles.scroll}>
				{TOOL_TYPES.map((tool) => (
					<View key={tool.type} style={styles.toolItemWrapper}>
						<DraggableTool
							type={tool.type}
							label={tool.label}
							onDrop={(zone) => onAddBlock && onAddBlock(tool.type, zone.path, zone.index)}
						>
							<TouchableOpacity
								style={styles.toolItem}
								onPress={() => onAddBlock && onAddBlock(tool.type)}
							>
								<Text style={styles.toolText}>{tool.label}</Text>
							</TouchableOpacity>
						</DraggableTool>
					</View>
				))}
			</ScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		backgroundColor: '#f0f0f0',
		flex: 1,
		padding: 10,
	},
	title: {
		fontSize: 14,
		fontWeight: 'bold',
		marginBottom: 5,
	},
	scroll: {
		alignItems: 'stretch',
	},
	toolItemWrapper: {
		marginBottom: 10,
		width: '100%',
	},
	toolItem: {
		backgroundColor: '#fff',
		padding: 10,
		borderRadius: 5,
		borderWidth: 1,
		borderColor: '#ddd',
		justifyContent: 'center',
		alignItems: 'center',
	},
	toolText: {
		fontSize: 12,
	},
});
