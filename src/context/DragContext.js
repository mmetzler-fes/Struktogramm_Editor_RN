import React, { createContext, useState, useContext, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, NativeModules, findNodeHandle } from 'react-native';

const DragContext = createContext();

export const useDrag = () => useContext(DragContext);

export const DragProvider = ({ children }) => {
	const [draggingItem, setDraggingItem] = useState(null);
	const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
	const [activeDropZone, setActiveDropZone] = useState(null);

	// Store refs to zones: { id: { ref: Component, data: { path, index } } }
	const dropZoneRefs = useRef({});
	// Cached Layouts for current drag: { id: { pageX, pageY, width, height, data } }
	const activeZoneLayouts = useRef({});

	const registerDropZone = (id, ref, data) => {
		dropZoneRefs.current[id] = { ref, data };
	};

	const unregisterDropZone = (id) => {
		delete dropZoneRefs.current[id];
	};

	const activeDropZoneRef = useRef(null);

	useEffect(() => {
		if (draggingItem) {
			setTimeout(() => { // Allow layout to settle
				activeZoneLayouts.current = {};
				Object.keys(dropZoneRefs.current).forEach(id => {
					const entry = dropZoneRefs.current[id];
					if (entry && entry.ref) {
						entry.ref.measure((x, y, width, height, pageX, pageY) => {
							if (width > 0 && height > 0) {
								activeZoneLayouts.current[id] = {
									pageX, pageY, width, height, ...entry.data
								};
							}
						});
					}
				});
			}, 100);
		}
	}, [draggingItem]);

	const onDragStart = (item, gestureState) => {
		setDraggingItem(item);
		setDragPosition({ x: gestureState.moveX, y: gestureState.moveY });
	};

	const onDragMove = (gestureState) => {
		const { moveX, moveY } = gestureState;
		setDragPosition({ x: moveX, y: moveY });

		let bestZone = null;
		for (const zone of Object.values(activeZoneLayouts.current)) {
			if (moveX >= zone.pageX && moveX <= zone.pageX + zone.width &&
				moveY >= zone.pageY && moveY <= zone.pageY + zone.height) {
				bestZone = { path: zone.path, index: zone.index };
				break;
			}
		}

		if (JSON.stringify(bestZone) !== JSON.stringify(activeDropZone)) {
			setActiveDropZone(bestZone);
			activeDropZoneRef.current = bestZone; // Sync ref
		}
	};

	const onDragEnd = () => {
		// Use ref to get latest value regardless of closure
		const result = { item: draggingItem, dropZone: activeDropZoneRef.current };
		setDraggingItem(null);
		setActiveDropZone(null);
		activeDropZoneRef.current = null;
		return result;
	};

	return (
		<DragContext.Provider value={{
			draggingItem, activeDropZone,
			registerDropZone, unregisterDropZone,
			onDragStart, onDragMove, onDragEnd
		}}>
			{children}
			{draggingItem && (
				<View
					style={[styles.dragOverlay, {
						left: dragPosition.x - 50,
						top: dragPosition.y - 20,
					}]}
					pointerEvents="none"
				>
					<View style={styles.ghostItem}>
						<Text style={{ color: '#fff', fontWeight: 'bold' }}>{draggingItem.label}</Text>
					</View>
				</View>
			)}
		</DragContext.Provider>
	);
};

const styles = StyleSheet.create({
	dragOverlay: {
		position: 'absolute',
		zIndex: 9999,
		elevation: 9999,
	},
	ghostItem: {
		width: 100,
		height: 40,
		backgroundColor: 'rgba(24, 144, 255, 0.8)',
		justifyContent: 'center',
		alignItems: 'center',
		borderRadius: 5,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
	}
});
