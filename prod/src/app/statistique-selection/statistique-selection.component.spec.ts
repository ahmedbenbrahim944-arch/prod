import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatistiqueSelectionComponent } from './statistique-selection.component';

describe('StatistiqueSelectionComponent', () => {
  let component: StatistiqueSelectionComponent;
  let fixture: ComponentFixture<StatistiqueSelectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatistiqueSelectionComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(StatistiqueSelectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
