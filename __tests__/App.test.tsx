/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'MaterialCommunityIcons');

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
