import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Planification2Component } from './planification2.component';

describe('Planification2Component', () => {
  let component: Planification2Component;
  let fixture: ComponentFixture<Planification2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Planification2Component]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(Planification2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
