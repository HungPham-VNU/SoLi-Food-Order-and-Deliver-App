import * as React from 'react';
import { Input } from './input';

export interface PriceInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value?: number;
  onChange?: (value: number | undefined) => void;
}

export function PriceInput({ value, onChange, className, ...props }: PriceInputProps) {
  const [textValue, setTextValue] = React.useState<string>(
    value !== undefined && value !== null ? value.toLocaleString('en-US') : ''
  );

  React.useEffect(() => {
    if (value !== undefined && value !== null) {
      const currentNumericValue = parseFloat(textValue.replace(/,/g, ''));
      if (currentNumericValue !== value) {
        setTextValue(value.toLocaleString('en-US'));
      }
    } else if (value === undefined || value === null) {
      setTextValue('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;
    
    // Remove all non-digits
    inputValue = inputValue.replace(/\D/g, '');
    
    const numericValue = parseInt(inputValue, 10);
    
    if (isNaN(numericValue)) {
      setTextValue('');
      onChange?.(undefined);
    } else {
      setTextValue(numericValue.toLocaleString('en-US'));
      onChange?.(numericValue);
    }
  };

  return (
    <Input
      type="text"
      value={textValue}
      onChange={handleChange}
      className={className}
      {...props}
    />
  );
}
