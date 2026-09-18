// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FirstStartSheet } from '../src/components/FirstStartSheet.js'

/**
 * Die Frage beim ersten Start. Bis zum 18. September bekam ein neues Gerät
 * still Berlin; jetzt wählt man einmal und die Wahl bleibt (Betreiber:
 * „für die nächsten Aufrufe gemerkt").
 */
afterEach(cleanup)

describe('FirstStartSheet', () => {
  it('fragt nach der Stadt, bietet erst das Land und lässt die Vorgabe behalten', () => {
    const onPick = vi.fn()
    const onKeep = vi.fn()
    render(<FirstStartSheet onPick={onPick} onKeep={onKeep} />)
    expect(screen.getByRole('dialog', { name: 'Stadt wählen' })).toBeTruthy()
    expect(screen.getByText('Wo parkst du?')).toBeTruthy()
    const land = screen.getByRole('combobox', { name: 'Land' }) as HTMLSelectElement
    expect(land.value).toBe('DE')
    // Die Vorgabe ist Berlin: in der Liste als aktuell markiert, nicht antippbar — und behaltbar.
    expect((screen.getByRole('button', { name: 'Berlin' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Berlin behalten' }))
    expect(onKeep).toHaveBeenCalledTimes(1)
    expect(onPick).not.toHaveBeenCalled()
  })

  it('reicht die gewählte Stadt durch — auch über eine Landesgrenze', () => {
    const onPick = vi.fn()
    render(<FirstStartSheet onPick={onPick} onKeep={() => {}} />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Land' }), { target: { value: 'AT' } })
    fireEvent.click(screen.getByRole('button', { name: /^Wien/ }))
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ key: 'wien' }))
  })
})
