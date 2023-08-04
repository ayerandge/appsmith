import styled from "styled-components";
import { Switch as HeadlessSwitch } from "@design-system/headless";

import type { SwitchProps } from ".";
import { inlineLabelStyles } from "../../styles/inlineLabelStyles";

export const StyledSwitch = styled(HeadlessSwitch)<SwitchProps>`
  ${inlineLabelStyles}

  [data-icon] {
    --gutter: 2px;
    --knob-size: var(--sizing-3);

    position: relative;
    width: var(--sizing-8);
    height: var(--sizing-4);
    background-color: var(--color-bd-neutral);
    border-radius: var(--knob-size);
    color: var(--color-bg);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    user-select: none;
    flex-shrink: 0;
  }

  [data-icon]::after {
    content: "";
    height: var(--knob-size);
    width: var(--knob-size);
    transition: all 0.2s ease;
    position: absolute;
    left: var(--gutter);
    border-radius: var(--knob-size);
    background-color: currentColor;
  }

  &[data-hovered]:not([data-disabled]) [data-icon] {
    background-color: var(--color-bd-neutral-hover);
  }

  /**
 * ----------------------------------------------------------------------------
 * CHECKED  - BUT NOT DISABLED
 *-----------------------------------------------------------------------------
 */
  &[data-state="checked"] [data-icon] {
    background-color: var(--color-bg-accent);
    color: var(--color-bg);
  }

  &[data-hovered][data-state="checked"]:not([data-disabled]) [data-icon] {
    background-color: var(--color-bg-accent-hover);
    color: var(--color-bg);
  }

  &[data-state="checked"] [data-icon]::after {
    left: calc(100% - var(--knob-size) - var(--gutter));
  }

  /**
  * ----------------------------------------------------------------------------
  * FOCUS
  *-----------------------------------------------------------------------------
  */
  &[data-focused] [data-icon] {
    box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-bd-focus);
  }
`;
