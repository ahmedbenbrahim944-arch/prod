import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatutManuelRhComponent } from './statut-manuel-rh.component';

describe('StatutManuelRhComponent', () => {
  let component: StatutManuelRhComponent;
  let fixture: ComponentFixture<StatutManuelRhComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatutManuelRhComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(StatutManuelRhComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
