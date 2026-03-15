import { Checkbox, CheckboxGroup, Stack } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import AsyncSelect from "react-select/async";

export interface ResourceSelectorProps {
  items?: any[];
  update: (key: string, value: any) => void;
  fieldName: string;
  selectPlaceholder: string;
  nameResolver?: (item: any) => string;
  valueResolver?: (item: any) => string;
  idResolver?: (item: any) => string;
  keyResolver?: (item: any) => string;
  stateResolver?: (item: any) => void;
  isCheckedResolver?: (item: any) => boolean;
  filter?: (item: any) => boolean;
  loadOptions: (inputValue: string) => Promise<any[]>;
}

export interface Option {
  value: string;
  label: string;
}

export const SingleResourceSelector = (props: ResourceSelectorProps) => {
  const {
    update,
    fieldName,
    nameResolver,
    valueResolver,
    stateResolver,
    filter,
    loadOptions,
    items,
  } = props;

  const onSelect = (option: Option) => {
    if (stateResolver) {
      stateResolver(option.value);
    } else {
      update(fieldName, option.value);
    }
  };

  const innerLoadOptions = async (inputValue: string): Promise<Option[]> => {
    const items = await loadOptions(inputValue);

    const filteredItems = filter ? items.filter(filter) : items;

    return filteredItems
      .filter((item) =>
        (nameResolver?.(item) ?? item.name)
          .toLowerCase()
          .includes(inputValue.toLowerCase())
      )
      .map((item) => ({
        value: valueResolver?.(item) ?? item.id,
        label: nameResolver?.(item) ?? item.name,
      }));
  };

  return (
    <AsyncSelect
      loadOptions={innerLoadOptions}
      onChange={onSelect}
      defaultOptions={items}
      placeholder={"Start typing to see options"}
      noOptionsMessage={() => <p>Nothing found :(</p>}
    />
  );
};

export const MultiResourceSelector = (props: ResourceSelectorProps) => {
  const {
    items,
    update,
    fieldName,
    nameResolver,
    keyResolver,
    filter,
    isCheckedResolver,
  } = props;

  const filteredItems = filter ? items.filter(filter) : items;

  const [checkedItems, setCheckedItems] = useState(
    filteredItems.map(isCheckedResolver ?? (() => false))
  );

  useEffect(() => {
    update(
      fieldName,
      filteredItems.filter((item, index) => checkedItems[index])
    );
  }, [fieldName, filteredItems, update, checkedItems]);

  if (filteredItems.length === 0) {
    return <p>No resources available</p>;
  }

  return (
    <CheckboxGroup colorScheme="green">
      <Stack pl={6} mt={1} spacing={1}>
        {filteredItems?.map((item, index) => (
          <Checkbox
            key={keyResolver?.(item) ?? item.id}
            isChecked={checkedItems[index]}
            onChange={(e) => {
              const checkedState = [...checkedItems];
              checkedState[index] = e.target.checked;
              setCheckedItems(checkedState);
            }}
          >
            {nameResolver?.(item) ?? item.name}
          </Checkbox>
        ))}
      </Stack>
    </CheckboxGroup>
  );
};
