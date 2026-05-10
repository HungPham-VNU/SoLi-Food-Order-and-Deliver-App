import React, { ReactNode } from "react";
import { View, Text, TextInput, TextInputProps } from "react-native";

interface SignUpFieldProps extends TextInputProps {
  label: string;
  icon: ReactNode;
  isFocused: boolean;
  error?: string;
}

export function SignUpField({ label, icon, isFocused, error, ...inputProps }: SignUpFieldProps) {
  return (
    <View className="gap-y-2">
      <Text
        className="text-[#1a1c1c] text-sm ml-1"
        style={{ fontFamily: "PlusJakartaSans_600SemiBold" }}
      >
        {label}
      </Text>

      <View
        className="flex-row items-center rounded-xl overflow-hidden"
        style={{
          backgroundColor: isFocused ? "#ffffff" : "#e8e8e8",
          borderWidth: isFocused ? 2 : (error ? 1 : 0),
          borderColor: isFocused ? "rgba(13, 99, 27, 0.3)" : (error ? "#ff4d4d" : "transparent"),
        }}
      >
        <View className="pl-4 pr-2">{icon}</View>
        <TextInput
          className="flex-1 py-4 pr-4 text-[#1a1c1c]"
          style={{ fontFamily: "Inter_400Regular", fontSize: 15 }}
          placeholderTextColor="#707a6c"
          {...inputProps}
        />
      </View>
      {!!error && (
        <Text
          className="text-[#ff4d4d] text-xs ml-1"
          style={{ fontFamily: "Inter_500Medium" }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
