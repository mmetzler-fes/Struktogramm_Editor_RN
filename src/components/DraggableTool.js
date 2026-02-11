import React, { useRef } from 'react';
import { View, PanResponder } from 'react-native';
import { useDrag } from '../context/DragContext';

export const DraggableTool = ({ type, label, children, onDrop }) => {
	const { onDragStart, onDragMove, onDragEnd } = useDrag();

	// Explicitly update refs on every render
	const callbacks = useRef({});
	callbacks.current = { onDragStart, onDragMove, onDragEnd, onDrop, type, label };

	const panResponder = useRef(
		PanResponder.create({
			onStartShouldSetPanResponder: () => false,
			onStartShouldSetPanResponderCapture: () => false,

			onMoveShouldSetPanResponder: (evt, gestureState) => {
				const { dx, dy } = gestureState;
				return Math.abs(dx) > 5 || Math.abs(dy) > 5;
			},
			onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
				const { dx, dy } = gestureState;
				return Math.abs(dx) > 5 || Math.abs(dy) > 5;
			},

			onPanResponderGrant: (evt, gestureState) => {
				const { onDragStart, type, label } = callbacks.current;
				onDragStart({ type, label }, gestureState);
			},
			onPanResponderMove: (evt, gestureState) => {
				const { onDragMove } = callbacks.current;
				onDragMove(gestureState);
			},
			onPanResponderRelease: () => {
				const { onDragEnd, onDrop } = callbacks.current;
				const result = onDragEnd();
				if (result && result.dropZone && onDrop) {
					onDrop(result.dropZone);
				}
			},
			onPanResponderTerminate: () => {
				const { onDragEnd } = callbacks.current;
				onDragEnd();
			}
		})
	).current;

	return (
		<View {...panResponder.panHandlers}>
			{children}
		</View>
	);
};
