import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Menu, ChevronDown } from 'lucide-react-native';

interface HomeTopBarProps {
  insetsTop: number;
}

export function HomeTopBar({ insetsTop }: HomeTopBarProps) {
  return (
    <View 
      className="absolute top-0 w-full z-50 bg-surface-container-lowest/90 shadow-sm"
      style={{ paddingTop: Math.max(insetsTop, 12), paddingBottom: 12 }}
    >
      <View className="flex-row items-center px-6 gap-2 w-full max-w-md mx-auto">
        <TouchableOpacity className="text-on-background p-2 -ml-2 rounded-full active:bg-surface-variant">
          <Menu size={24} color="#1a1c1c" />
        </TouchableOpacity>
        
        <View className="flex-col items-start flex-1 ml-2">
          <Text className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-inter leading-none mb-0.5">
            Deliver to
          </Text>
          <TouchableOpacity className="flex-row items-center gap-1">
            <Text className="font-jakarta-sans font-bold text-lg text-on-surface leading-tight">
              Asia Square Tower 2
            </Text>
            <ChevronDown size={18} color="#00490e" />
          </TouchableOpacity>
        </View>

        <View className="w-10 h-10 rounded-full bg-surface-container overflow-hidden ring-2 ring-primary/20 shadow-sm">
          <Image 
            source={{ uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuCOTNFg5xLNhg4ibo1deIjw7n921_AMMLLTpr2ESna4XzRPuSnbvlu7zjFtK-1xfdkQnQEoGAGduWUpLIHUgfjjd0rGHbOULjKTCQOIMuCNNrX8WKz37582RBecKs6u4chcDD72BadZvLaN_ddoSK1Wt_tJdY-evJLPWUybjGblLKjFVhbvnfk6wFASZ1Cv89DRvzrsr_bLnJjLTw8ISRIp9O1yfwEKY9gpPdSmfBCp6DlLSCLRYJc8PfySytbwpBnvMEIaAN1OU1Ov" }}
            className="w-full h-full"
            contentFit="cover"
          />
        </View>
      </View>
    </View>
  );
}
