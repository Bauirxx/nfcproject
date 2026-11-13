import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SortableList, type SortableListLabels } from './sortable-list';

const labels: SortableListLabels = {
  dragHandle: 'Arrastar',
  moveUp: 'Mover para cima',
  moveDown: 'Mover para baixo',
};

function renderList(onMove = vi.fn()) {
  render(
    <SortableList
      ids={['a', 'b', 'c']}
      onMove={onMove}
      labels={labels}
      renderItem={(id) => <span>item {id}</span>}
    />,
  );
  return onMove;
}

describe('SortableList', () => {
  it('mostra todos os itens pela ordem dada', () => {
    renderList();
    expect(screen.getByText('item a')).toBeInTheDocument();
    expect(screen.getByText('item c')).toBeInTheDocument();
  });

  it('move um item para baixo pelo botão', async () => {
    const user = userEvent.setup();
    const onMove = renderList();
    await user.click(screen.getAllByRole('button', { name: 'Mover para baixo' })[0]!);
    expect(onMove).toHaveBeenCalledWith(0, 1);
  });

  it('move um item para cima pelo botão', async () => {
    const user = userEvent.setup();
    const onMove = renderList();
    await user.click(screen.getAllByRole('button', { name: 'Mover para cima' })[2]!);
    expect(onMove).toHaveBeenCalledWith(2, 1);
  });

  it('desativa subir no primeiro e descer no último', () => {
    renderList();
    expect(screen.getAllByRole('button', { name: 'Mover para cima' })[0]).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Mover para baixo' })[2]).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Mover para cima' })[1]).toBeEnabled();
  });
});
