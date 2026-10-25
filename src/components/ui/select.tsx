import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import './select.css';

const EMPTY_OPTION = '__staple_empty_option__';

type ItemProps = {
  value?: string | number;
  children: React.ReactNode;
  disabled?: boolean;
};
function itemText(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number')
        return String(child);
      return React.isValidElement<{ children?: React.ReactNode }>(child)
        ? itemText(child.props.children)
        : '';
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}
function itemsFrom(children: React.ReactNode): ItemProps[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement<ItemProps>(child)) return [];
    if (child.type === React.Fragment) return itemsFrom(child.props.children);
    return child.type === SelectItem ? [child.props] : [];
  });
}
export function SelectItem({ value, children, disabled }: ItemProps) {
  const text = itemText(children);
  const rawValue = value === undefined ? text : String(value);
  return (
    <SelectPrimitive.Item
      value={rawValue || EMPTY_OPTION}
      textValue={text}
      disabled={disabled}
      data-value={rawValue}
      className="select-item"
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="select-item-check">
        <Check size={15} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

type SelectProps = Omit<
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>,
  'value' | 'defaultValue' | 'onChange' | 'children'
> & {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  name?: string;
  required?: boolean;
  form?: string;
  placeholder?: string;
};

/** Shared single-select: native form participation with a keyboard-accessible, portalled menu. */
export function Select({
  value,
  onValueChange,
  children,
  name,
  required,
  form,
  disabled,
  className,
  placeholder,
  ...props
}: SelectProps) {
  const trigger = React.useRef<HTMLButtonElement>(null);
  const [invalid, setInvalid] = React.useState(false);
  const items = itemsFrom(children);
  const empty = items.find(
    (item) => String(item.value ?? itemText(item.children)) === '',
  );
  const selected = items.find(
    (item) => String(item.value ?? itemText(item.children)) === value,
  );
  return (
    <span
      className="select-field"
      onInvalidCapture={(event) => {
        event.preventDefault();
        setInvalid(true);
        trigger.current?.focus();
      }}
    >
      <SelectPrimitive.Root
        value={value}
        onValueChange={(next) => {
          setInvalid(false);
          onValueChange(next === EMPTY_OPTION ? '' : next);
        }}
        name={name}
        required={required}
        form={form}
        disabled={disabled}
      >
        <SelectPrimitive.Trigger
          {...props}
          ref={trigger}
          disabled={disabled}
          className={cn('select-trigger', className)}
          aria-invalid={props['aria-invalid'] ?? (invalid || undefined)}
        >
          <span className="select-trigger-label">
            <SelectPrimitive.Value
              placeholder={empty?.children ?? placeholder ?? 'Choose an option'}
            >
              {selected?.children}
            </SelectPrimitive.Value>
          </span>
          <SelectPrimitive.Icon className="select-trigger-icon">
            <ChevronDown size={16} />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className="select-content"
            position="popper"
            sideOffset={5}
            collisionPadding={12}
            align="start"
            onKeyDown={(event) => event.stopPropagation()}
          >
            <SelectPrimitive.ScrollUpButton className="select-scroll-button">
              <ChevronUp size={15} />
            </SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport className="select-viewport">
              {children}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton className="select-scroll-button">
              <ChevronDown size={15} />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </span>
  );
}
