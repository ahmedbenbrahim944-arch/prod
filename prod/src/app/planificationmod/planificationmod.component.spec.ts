import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlanificationmodComponent } from './planificationmod.component';

describe('PlanificationmodComponent', () => {
  let component: PlanificationmodComponent;
  let fixture: ComponentFixture<PlanificationmodComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlanificationmodComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PlanificationmodComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
