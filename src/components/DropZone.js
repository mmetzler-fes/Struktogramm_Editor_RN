import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useDrag } from '../context/DragContext';

export const DropZone = ({ path, index, isHorizontal }) => {
	const { registerDropZone, unregisterDropZone, draggingItem, activeDropZone } = useDrag();
	const viewRef = useRef(null);
	// Unique ID for registration
	const id = path.join('-') + '-' + index;

	useEffect(() => {
		if (viewRef.current) {
			registerDropZone(id, viewRef.current, { path, index });
		}
		return () => unregisterDropZone(id);
	}, [id]);

	// Check if this zone is the active target
	const isActive = activeDropZone &&
		activeDropZone.index === index &&
		JSON.stringify(activeDropZone.path) === JSON.stringify(path);

	const isVisible = !!draggingItem;

	return (
		<View
			ref={viewRef}
			collapsable={false} // Important for measure() on Android
			style={[
				styles.dropZone,
				isHorizontal && styles.dropZoneHorizontal,
				isVisible && styles.dropZoneVisible,
				isActive && styles.dropZoneActive
			]}
		/>
	);
};

const styles = StyleSheet.create({
	dropZone: {
		height: 0, // Hidden by default
		width: '100%',
		backgroundColor: 'transparent',
		marginVertical: 0,
		zIndex: 10,
	},
	dropZoneVisible: {
		height: 20, // Expand to show potential drop slot
		marginVertical: -10, // Overlap neighbors slightly? Or just expand space?
		// User wants "gap". So expand space.
		marginVertical: 4,
	},
	dropZoneHorizontal: {
		width: 20,
		height: '100%',
	},
	dropZoneActive: {
		backgroundColor: 'rgba(24, 144, 255, 0.2)',
		borderColor: '#1890ff',
		borderWidth: 2,
		borderStyle: 'dashed',
		height: 40, // Larger hit area when active
	},
});
