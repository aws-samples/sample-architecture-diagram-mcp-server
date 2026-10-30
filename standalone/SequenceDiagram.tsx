// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Animated UML sequence view: a tab of a multi-tab diagram document. The
// renderer is the core's <SequencePlayer> (shared with the slides deck); this
// wires in the standalone bundle's inlined icon set.
import { SequencePlayer } from '@aws-sample-live-diagram/core/react';
import { resolveIcon, iconFilter } from '@/lib/icons';

type Any = any;

export function SequenceDiagram({ seq, lang = 'en', active = true, ui }: Any) {
  return <SequencePlayer seq={seq} lang={lang} active={active} ui={ui} iconUrl={resolveIcon} iconFilter={iconFilter} />;
}

export default SequenceDiagram;
