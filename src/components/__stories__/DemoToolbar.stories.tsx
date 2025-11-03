import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useRef } from 'react';

import '@/components/DemoToolbar';

interface DemoToolbarStoryProps {
  lang?: 'EN' | 'NL' | 'RU';
  exportDisabled?: boolean;
  exportLabel?: string;
  exportEmptyLabel?: string;
}

const DemoToolbarPreview = (props: DemoToolbarStoryProps) => {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const toolbar = ref.current as HTMLElement & { lang?: string } | null;
    if (!toolbar) return;
    if (props.lang) {
      (toolbar as any).lang = props.lang;
    }
    if (props.exportLabel) {
      toolbar.setAttribute('export-label', props.exportLabel);
    } else {
      toolbar.removeAttribute('export-label');
    }
    if (props.exportEmptyLabel) {
      toolbar.setAttribute('export-empty-label', props.exportEmptyLabel);
    } else {
      toolbar.removeAttribute('export-empty-label');
    }
    if (props.exportDisabled) {
      toolbar.setAttribute('export-disabled', '');
    } else {
      toolbar.removeAttribute('export-disabled');
    }
  }, [props.lang, props.exportDisabled, props.exportLabel, props.exportEmptyLabel]);

  return (
    <div style={{ background: '#05121a', padding: '24px' }}>
      {/** @ts-expect-error JSX intrinsic typing for custom elements */}
      <demo-toolbar ref={ref} style={{ display: 'block', maxWidth: 960 }} />
    </div>
  );
};

const meta: Meta<DemoToolbarStoryProps> = {
  title: 'Components/DemoToolbar',
  component: DemoToolbarPreview,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    lang: {
      control: 'select',
      options: ['EN', 'NL', 'RU'],
    },
  },
  args: {
    lang: 'EN',
  },
};

export default meta;

type Story = StoryObj<DemoToolbarStoryProps>;

export const Default: Story = {
  render: args => <DemoToolbarPreview {...args} />,
};

export const RussianActive: Story = {
  render: args => <DemoToolbarPreview {...args} />,
  args: {
    lang: 'RU',
  },
};

export const ExportDisabled: Story = {
  render: args => <DemoToolbarPreview {...args} />,
  args: {
    exportDisabled: true,
    exportEmptyLabel: 'No data to export',
  },
};
