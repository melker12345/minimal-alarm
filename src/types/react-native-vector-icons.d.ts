declare module 'react-native-vector-icons/MaterialCommunityIcons' {
  import {ComponentType} from 'react';
  import {TextStyle} from 'react-native';

  type Props = {
    name: string;
    size?: number;
    color?: string;
    style?: TextStyle;
  };

  const MaterialCommunityIcons: ComponentType<Props>;
  export default MaterialCommunityIcons;
}
